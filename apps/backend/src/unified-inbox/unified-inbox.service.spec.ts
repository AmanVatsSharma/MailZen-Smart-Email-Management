import { UnifiedInboxService } from './unified-inbox.service';

describe('UnifiedInboxService (smoke)', () => {
  const userId = 'user-1';
  const providerId = 'prov-1';

  const makePrisma = () => ({
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: userId, activeInboxType: 'PROVIDER', activeInboxId: providerId }),
    },
    emailProvider: {
      findFirst: jest.fn().mockResolvedValue({ id: providerId, userId, type: 'GMAIL', accessToken: 'token', tokenExpiry: null }),
      findMany: jest.fn().mockResolvedValue([{ id: providerId, userId, type: 'GMAIL', isActive: true }]),
    },
    externalEmailMessage: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'm1',
          userId,
          providerId,
          externalMessageId: 'ext1',
          threadId: 't1',
          from: 'Alice <alice@example.com>',
          to: ['you@example.com'],
          subject: 'Hello',
          snippet: 'Hi there',
          internalDate: new Date('2024-01-01T00:00:00.000Z'),
          labels: ['INBOX', 'UNREAD'],
          rawPayload: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'm1',
        userId,
        providerId,
        externalMessageId: 'ext1',
        threadId: 't1',
        from: 'Alice <alice@example.com>',
        to: ['you@example.com'],
        subject: 'Hello',
        snippet: 'Hi there',
        internalDate: new Date('2024-01-01T00:00:00.000Z'),
        labels: ['INBOX', 'UNREAD'],
        rawPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    externalEmailLabel: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  });

  it('listThreads maps ExternalEmailMessage into EmailThread shape', async () => {
    const prisma = makePrisma();
    const svc = new UnifiedInboxService(prisma as any);
    const threads = await svc.listThreads(userId, 10, 0, { folder: 'inbox' } as any, null);

    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: 't1',
      subject: 'Hello',
      folder: 'inbox',
      isUnread: true,
      providerId,
    });
    expect(threads[0].messages[0]).toMatchObject({
      contentPreview: 'Hi there',
      status: 'unread',
    });
  });

  it('updateThread (non-gmail path) updates labels locally', async () => {
    const prisma = makePrisma();
    prisma.emailProvider.findFirst.mockResolvedValue({ id: providerId, userId, type: 'CUSTOM_SMTP' });

    const svc = new UnifiedInboxService(prisma as any);
    await svc.updateThread(userId, 't1', { read: true, starred: true, folder: 'archive' } as any);

    // should have persisted label changes via updates
    expect(prisma.externalEmailMessage.update).toHaveBeenCalled();
  });
});

