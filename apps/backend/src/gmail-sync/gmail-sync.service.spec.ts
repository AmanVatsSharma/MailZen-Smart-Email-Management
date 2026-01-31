import axios from 'axios';
import { GmailSyncService } from './gmail-sync.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  get: jest.fn(),
}));

describe('GmailSyncService (smoke)', () => {
  const userId = 'user-1';
  const providerId = 'prov-1';

  const makePrisma = () => ({
    emailProvider: {
      findFirst: jest.fn().mockResolvedValue({
        id: providerId,
        userId,
        type: 'GMAIL',
        accessToken: 'token',
        refreshToken: null,
        tokenExpiry: null,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    externalEmailLabel: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    externalEmailMessage: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  });

  it('syncGmailProvider best-effort syncs labels and upserts messages', async () => {
    const prisma = makePrisma();

    // labels list
    (axios.get as any).mockImplementation((url: string) => {
      if (url.includes('/labels')) {
        return Promise.resolve({ data: { labels: [{ id: 'Label_1', name: 'Work', type: 'user' }] } });
      }
      if (url.endsWith('/messages')) {
        return Promise.resolve({ data: { messages: [{ id: 'm1', threadId: 't1' }] } });
      }
      if (url.includes('/messages/')) {
        return Promise.resolve({
          data: {
            id: 'm1',
            threadId: 't1',
            labelIds: ['INBOX'],
            snippet: 'hello',
            internalDate: String(Date.now()),
            payload: { headers: [{ name: 'From', value: 'Alice <alice@example.com>' }, { name: 'To', value: 'you@example.com' }, { name: 'Subject', value: 'Hi' }] },
          },
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const svc = new GmailSyncService(prisma as any);
    const res = await svc.syncGmailProvider(providerId, userId, 1);

    expect(res.imported).toBe(1);
    expect(prisma.externalEmailLabel.upsert).toHaveBeenCalled();
    expect(prisma.externalEmailMessage.upsert).toHaveBeenCalled();
  });
});

