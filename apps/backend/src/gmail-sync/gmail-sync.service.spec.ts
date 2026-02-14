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
      { status: 'syncing' },
    );
  });
});
