/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import axios from 'axios';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';
import { GmailSyncService } from './gmail-sync.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  post: jest.fn(),
}));

describe('GmailSyncService', () => {
  const userId = 'user-1';
  const providerId = 'provider-1';
  const originalPushTopicEnv = process.env.GMAIL_PUSH_TOPIC_NAME;

  let emailProviderRepo: jest.Mocked<Repository<EmailProvider>>;
  let labelRepo: jest.Mocked<Repository<ExternalEmailLabel>>;
  let messageRepo: jest.Mocked<Repository<ExternalEmailMessage>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  let providerSyncLease: jest.Mocked<
    Pick<ProviderSyncLeaseService, 'acquireProviderSyncLease'>
  >;
  let service: GmailSyncService;

  beforeEach(() => {
    emailProviderRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    labelRepo = {
      upsert: jest.fn(),
    } as unknown as jest.Mocked<Repository<ExternalEmailLabel>>;
    messageRepo = {
      upsert: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ExternalEmailMessage>>;
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    providerSyncLease = {
      acquireProviderSyncLease: jest.fn().mockResolvedValue(true),
    };

    service = new GmailSyncService(
      emailProviderRepo,
      labelRepo,
      messageRepo,
      auditLogRepo,
      providerSyncLease as unknown as ProviderSyncLeaseService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GMAIL_PUSH_TOPIC_NAME;
  });

  afterAll(() => {
    if (typeof originalPushTopicEnv === 'string') {
      process.env.GMAIL_PUSH_TOPIC_NAME = originalPushTopicEnv;
      return;
    }
    delete process.env.GMAIL_PUSH_TOPIC_NAME;
  });

  it('syncs labels and upserts message metadata', async () => {
    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'GMAIL',
      accessToken: 'token',
      refreshToken: null,
      tokenExpiry: null,
    } as any);
    (axios.get as any).mockImplementation((url: string) => {
      if (url.endsWith('/labels')) {
        return Promise.resolve({
          data: { labels: [{ id: 'LBL_1', name: 'Work', type: 'user' }] },
        });
      }
      if (url.endsWith('/messages')) {
        return Promise.resolve({
          data: { messages: [{ id: 'msg-1', threadId: 'thread-1' }] },
        });
      }
      if (url.includes('/messages/')) {
        return Promise.resolve({
          data: {
            id: 'msg-1',
            threadId: 'thread-1',
            labelIds: ['INBOX'],
            snippet: 'hello',
            internalDate: String(Date.now()),
            payload: {
              headers: [
                { name: 'From', value: 'Alice <alice@example.com>' },
                { name: 'To', value: 'you@example.com' },
                { name: 'Subject', value: 'Hi' },
              ],
            },
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.syncGmailProvider(providerId, userId, 1);

    expect(result).toEqual({ imported: 1 });
    expect(labelRepo.upsert).toHaveBeenCalled();
    expect(messageRepo.upsert).toHaveBeenCalled();
    expect(emailProviderRepo.update).toHaveBeenCalledWith(
      { id: providerId },
      {
        status: 'syncing',
        lastSyncError: null,
        lastSyncErrorAt: null,
      },
    );
  });

  it('uses gmail history cursor for incremental sync when available', async () => {
    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'GMAIL',
      accessToken: 'token',
      refreshToken: null,
      tokenExpiry: null,
      gmailHistoryId: 'hist-1',
    } as any);
    (axios.get as any).mockImplementation((url: string) => {
      if (url.endsWith('/labels')) {
        return Promise.resolve({
          data: { labels: [{ id: 'LBL_1', name: 'Work', type: 'user' }] },
        });
      }
      if (url.endsWith('/history')) {
        return Promise.resolve({
          data: {
            historyId: 'hist-2',
            history: [
              {
                messagesAdded: [
                  {
                    message: { id: 'msg-2', threadId: 'thread-2' },
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.includes('/messages/')) {
        return Promise.resolve({
          data: {
            id: 'msg-2',
            threadId: 'thread-2',
            labelIds: ['INBOX', 'UNREAD'],
            snippet: 'incremental',
            internalDate: String(Date.now()),
            payload: {
              headers: [
                { name: 'From', value: 'Bob <bob@example.com>' },
                { name: 'To', value: 'you@example.com' },
                { name: 'Subject', value: 'Incremental' },
              ],
            },
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.syncGmailProvider(providerId, userId, 10);

    expect(result).toEqual({ imported: 1 });
    expect(emailProviderRepo.update).toHaveBeenCalledWith(
      { id: providerId },
      expect.objectContaining({
        status: 'connected',
        gmailHistoryId: 'hist-2',
        syncLeaseExpiresAt: null,
        lastSyncError: null,
        lastSyncErrorAt: null,
      }),
    );
  });

  it('marks provider as error and clears lease when sync fails', async () => {
    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'GMAIL',
      accessToken: 'token',
      refreshToken: null,
      tokenExpiry: null,
    } as any);
    (axios.get as any).mockImplementation((url: string) => {
      if (url.endsWith('/labels')) {
        return Promise.resolve({
          data: { labels: [] },
        });
      }
      if (url.endsWith('/messages')) {
        return Promise.reject(new Error('gmail unavailable'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await expect(
      service.syncGmailProvider(providerId, userId, 1),
    ).rejects.toThrow('Failed to sync Gmail provider');

    expect(emailProviderRepo.update).toHaveBeenCalledWith(
      { id: providerId },
      expect.objectContaining({
        status: 'error',
        syncLeaseExpiresAt: null,
        lastSyncError: 'gmail unavailable',
        lastSyncErrorAt: expect.any(Date),
      }),
    );
  });

  it('processes gmail push notification for matching providers', async () => {
    emailProviderRepo.find.mockResolvedValue([
      {
        id: providerId,
        userId,
        type: 'GMAIL',
        email: 'founder@mailzen.com',
        isActive: true,
        gmailHistoryId: '100',
      } as any,
    ]);
    const syncSpy = jest
      .spyOn(service, 'syncGmailProvider')
      .mockResolvedValue({ imported: 2 });

    const result = await service.processPushNotification({
      emailAddress: 'Founder@MailZen.com',
      historyId: '120',
    });

    expect(result).toEqual({
      processedProviders: 1,
      skippedProviders: 0,
    });
    expect(providerSyncLease.acquireProviderSyncLease).toHaveBeenCalledWith({
      providerId,
      providerType: 'GMAIL',
    });
    expect(emailProviderRepo.update).toHaveBeenCalledWith(
      { id: providerId },
      { gmailHistoryId: '120' },
    );
    expect(syncSpy).toHaveBeenCalledWith(providerId, userId, 25);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        action: 'gmail_push_notification_processed',
      }),
    );
  });

  it('skips processing when provider lease cannot be acquired', async () => {
    emailProviderRepo.find.mockResolvedValue([
      {
        id: providerId,
        userId,
        type: 'GMAIL',
        email: 'founder@mailzen.com',
        isActive: true,
      } as any,
    ]);
    providerSyncLease.acquireProviderSyncLease.mockResolvedValue(false);
    const syncSpy = jest
      .spyOn(service, 'syncGmailProvider')
      .mockResolvedValue({ imported: 1 });

    const result = await service.processPushNotification({
      emailAddress: 'founder@mailzen.com',
      historyId: '100',
    });

    expect(result).toEqual({
      processedProviders: 0,
      skippedProviders: 1,
    });
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('records failed push processing audit action when sync throws', async () => {
    emailProviderRepo.find.mockResolvedValue([
      {
        id: providerId,
        userId,
        type: 'GMAIL',
        email: 'founder@mailzen.com',
        isActive: true,
      } as any,
    ]);
    jest
      .spyOn(service, 'syncGmailProvider')
      .mockRejectedValue(new Error('sync unavailable'));

    const result = await service.processPushNotification({
      emailAddress: 'founder@mailzen.com',
      historyId: '121',
    });

    expect(result).toEqual({
      processedProviders: 0,
      skippedProviders: 1,
    });
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        action: 'gmail_push_notification_failed',
      }),
    );
  });

  it('renews gmail push watch for provider when topic configured', async () => {
    process.env.GMAIL_PUSH_TOPIC_NAME = 'projects/mailzen/topics/gmail-push';
    const axiosPostMock = axios.post as jest.MockedFunction<typeof axios.post>;
    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'GMAIL',
      accessToken: 'token',
      refreshToken: null,
      tokenExpiry: null,
      gmailHistoryId: '100',
      gmailWatchExpirationAt: new Date(Date.now() - 1000),
    } as any);
    axiosPostMock.mockResolvedValue({
      data: {
        historyId: '110',
        expiration: String(Date.now() + 60 * 60 * 1000),
      },
    } as any);

    const result = await service.ensurePushWatchForProvider(providerId, userId);

    expect(result).toBe(true);
    expect(axiosPostMock).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/watch',
      expect.objectContaining({
        topicName: 'projects/mailzen/topics/gmail-push',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
    expect(emailProviderRepo.update).toHaveBeenCalledWith(
      { id: providerId },
      expect.objectContaining({
        gmailHistoryId: '110',
        gmailWatchLastRenewedAt: expect.any(Date),
        gmailWatchExpirationAt: expect.any(Date),
      }),
    );
  });
});
