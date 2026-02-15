import axios from 'axios';
import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { GmailSyncService } from './gmail-sync.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  get: jest.fn(),
}));

describe('GmailSyncService', () => {
  const userId = 'user-1';
  const providerId = 'provider-1';

  let emailProviderRepo: jest.Mocked<Repository<EmailProvider>>;
  let labelRepo: jest.Mocked<Repository<ExternalEmailLabel>>;
  let messageRepo: jest.Mocked<Repository<ExternalEmailMessage>>;
  let service: GmailSyncService;

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
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ExternalEmailMessage>>;

    service = new GmailSyncService(emailProviderRepo, labelRepo, messageRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
});
