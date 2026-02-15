/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import axios from 'axios';
import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { OutlookSyncService } from './outlook-sync.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  post: jest.fn(),
}));

describe('OutlookSyncService', () => {
  const userId = 'user-1';
  const providerId = 'provider-1';
  type AxiosGetResponse = Awaited<ReturnType<typeof axios.get>>;
  type AxiosPostResponse = Awaited<ReturnType<typeof axios.post>>;

  let emailProviderRepo: jest.Mocked<Repository<EmailProvider>>;
  let labelRepo: jest.Mocked<Repository<ExternalEmailLabel>>;
  let messageRepo: jest.Mocked<Repository<ExternalEmailMessage>>;
  let service: OutlookSyncService;

  beforeEach(() => {
    emailProviderRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    labelRepo = {
      upsert: jest.fn(),
    } as unknown as jest.Mocked<Repository<ExternalEmailLabel>>;
    messageRepo = {
      upsert: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<ExternalEmailMessage>>;

    service = new OutlookSyncService(emailProviderRepo, labelRepo, messageRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('syncs Outlook messages and upserts metadata', async () => {
    const axiosGetMock = axios.get as jest.MockedFunction<typeof axios.get>;
    const labelUpsertMock = labelRepo.upsert as unknown as jest.Mock;
    const messageUpsertMock = messageRepo.upsert as unknown as jest.Mock;
    const providerUpdateMock = emailProviderRepo.update as unknown as jest.Mock;

    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'OUTLOOK',
      accessToken: 'token',
      refreshToken: null,
      tokenExpiry: null,
      outlookSyncCursor: null,
    } as unknown as EmailProvider);
    axiosGetMock
      .mockResolvedValueOnce({
        data: {
          value: [
            {
              id: 'msg-1',
              conversationId: 'conv-1',
              subject: 'Quarterly Update',
              bodyPreview: 'Preview',
              receivedDateTime: '2026-02-15T10:00:00.000Z',
              isRead: false,
              from: {
                emailAddress: { name: 'Alice', address: 'alice@example.com' },
              },
              toRecipients: [
                {
                  emailAddress: {
                    name: 'Sales',
                    address: 'sales@mailzen.com',
                  },
                },
              ],
              categories: ['important'],
            },
          ],
        },
      } as AxiosGetResponse)
      .mockResolvedValueOnce({
        data: {
          '@odata.deltaLink':
            'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=abc',
          value: [],
        },
      } as AxiosGetResponse);

    const result = await service.syncOutlookProvider(providerId, userId, 1);

    expect(result).toEqual({ imported: 1 });
    expect(labelUpsertMock).toHaveBeenCalled();
    expect(messageUpsertMock).toHaveBeenCalled();
    expect(providerUpdateMock).toHaveBeenCalledWith(
      { id: providerId },
      {
        status: 'syncing',
        lastSyncError: null,
        lastSyncErrorAt: null,
      },
    );
    expect(providerUpdateMock).toHaveBeenCalledWith(
      { id: providerId },
      expect.objectContaining({
        status: 'connected',
        syncLeaseExpiresAt: null,
        lastSyncError: null,
        lastSyncErrorAt: null,
        outlookSyncCursor:
          'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=abc',
      }),
    );
  });

  it('refreshes Outlook token when expiring soon', async () => {
    const axiosGetMock = axios.get as jest.MockedFunction<typeof axios.get>;
    const axiosPostMock = axios.post as jest.MockedFunction<typeof axios.post>;
    const providerUpdateMock = emailProviderRepo.update as unknown as jest.Mock;

    process.env.OUTLOOK_CLIENT_ID = 'client-id';
    process.env.OUTLOOK_CLIENT_SECRET = 'client-secret';

    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'OUTLOOK',
      accessToken: 'stale-token',
      refreshToken: 'refresh-token',
      tokenExpiry: new Date(Date.now() - 60_000),
      outlookSyncCursor: null,
    } as unknown as EmailProvider);
    axiosPostMock.mockResolvedValue({
      data: {
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh-token',
        expires_in: 3600,
      },
    } as AxiosPostResponse);
    axiosGetMock
      .mockResolvedValueOnce({
        data: { value: [] },
      } as AxiosGetResponse)
      .mockResolvedValueOnce({
        data: {
          '@odata.deltaLink':
            'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=xyz',
          value: [],
        },
      } as AxiosGetResponse);

    await service.syncOutlookProvider(providerId, userId, 1);

    expect(axiosPostMock).toHaveBeenCalled();
    const tokenUpdateCall = providerUpdateMock.mock.calls.find((call) => {
      const payload = call[1] as { accessToken?: string };
      return Boolean(payload.accessToken);
    });
    expect(tokenUpdateCall).toBeDefined();
    const tokenUpdatePayload = tokenUpdateCall?.[1] as {
      accessToken: string;
      refreshToken: string;
    };
    expect(tokenUpdatePayload.accessToken).toMatch(/^enc:v2:/);
    expect(tokenUpdatePayload.refreshToken).toMatch(/^enc:v2:/);
  });

  it('marks provider as error and clears lease when sync fails', async () => {
    const axiosGetMock = axios.get as jest.MockedFunction<typeof axios.get>;
    const providerUpdateMock = emailProviderRepo.update as unknown as jest.Mock;

    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'OUTLOOK',
      accessToken: 'token',
      refreshToken: null,
      tokenExpiry: null,
      outlookSyncCursor: null,
    } as unknown as EmailProvider);
    axiosGetMock.mockRejectedValue(new Error('graph unavailable'));

    await expect(
      service.syncOutlookProvider(providerId, userId, 1),
    ).rejects.toThrow('Failed to sync Outlook provider');

    expect(providerUpdateMock).toHaveBeenCalledWith(
      { id: providerId },
      expect.objectContaining({
        status: 'error',
        syncLeaseExpiresAt: null,
        lastSyncError: 'graph unavailable',
        lastSyncErrorAt: expect.any(Date),
      }),
    );
  });

  it('uses incremental cursor and handles removed events', async () => {
    const axiosGetMock = axios.get as jest.MockedFunction<typeof axios.get>;
    const messageUpsertMock = messageRepo.upsert as unknown as jest.Mock;
    const messageDeleteMock = messageRepo.delete as unknown as jest.Mock;
    const providerUpdateMock = emailProviderRepo.update as unknown as jest.Mock;

    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'OUTLOOK',
      accessToken: 'token',
      refreshToken: null,
      tokenExpiry: null,
      outlookSyncCursor:
        'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=prev',
    } as unknown as EmailProvider);
    axiosGetMock.mockResolvedValue({
      data: {
        value: [
          {
            id: 'msg-2',
            conversationId: 'conv-2',
            subject: 'Renewal Reminder',
            bodyPreview: 'Please renew',
            receivedDateTime: '2026-02-16T08:00:00.000Z',
            isRead: true,
            categories: ['finance'],
          },
          {
            id: 'msg-old',
            '@removed': { reason: 'deleted' },
          },
        ],
        '@odata.deltaLink':
          'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=next',
      },
    } as AxiosGetResponse);

    const result = await service.syncOutlookProvider(providerId, userId, 10);

    expect(result).toEqual({ imported: 1 });
    expect(messageUpsertMock).toHaveBeenCalledTimes(1);
    expect(messageDeleteMock).toHaveBeenCalledWith({
      providerId,
      externalMessageId: 'msg-old',
    });
    expect(providerUpdateMock).toHaveBeenCalledWith(
      { id: providerId },
      expect.objectContaining({
        status: 'connected',
        outlookSyncCursor:
          'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=next',
      }),
    );
  });

  it('falls back to full sync when incremental cursor request fails', async () => {
    const axiosGetMock = axios.get as jest.MockedFunction<typeof axios.get>;
    const providerUpdateMock = emailProviderRepo.update as unknown as jest.Mock;

    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'OUTLOOK',
      accessToken: 'token',
      refreshToken: null,
      tokenExpiry: null,
      outlookSyncCursor:
        'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=broken',
    } as unknown as EmailProvider);
    axiosGetMock
      .mockRejectedValueOnce(new Error('delta cursor gone'))
      .mockResolvedValueOnce({
        data: {
          value: [
            {
              id: 'msg-fallback-1',
              conversationId: 'conv-fallback-1',
              subject: 'Fallback sync',
              bodyPreview: 'fallback body',
              receivedDateTime: '2026-02-16T09:00:00.000Z',
              isRead: false,
              categories: ['fallback'],
            },
          ],
        },
      } as AxiosGetResponse)
      .mockResolvedValueOnce({
        data: {
          '@odata.deltaLink':
            'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=fallback-next',
          value: [],
        },
      } as AxiosGetResponse);

    const result = await service.syncOutlookProvider(providerId, userId, 25);

    expect(result).toEqual({ imported: 1 });
    expect(providerUpdateMock).toHaveBeenCalledWith(
      { id: providerId },
      expect.objectContaining({
        status: 'connected',
        outlookSyncCursor:
          'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=fallback-next',
      }),
    );
  });
});
