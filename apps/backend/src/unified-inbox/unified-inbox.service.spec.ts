import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { User } from '../user/entities/user.entity';
import { UnifiedInboxService } from './unified-inbox.service';

describe('UnifiedInboxService', () => {
  const userId = 'user-1';
  const providerId = 'provider-1';

  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let messageRepo: jest.Mocked<Repository<ExternalEmailMessage>>;
  let labelRepo: jest.Mocked<Repository<ExternalEmailLabel>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let service: UnifiedInboxService;

  beforeEach(() => {
    providerRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    messageRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<ExternalEmailMessage>>;
    labelRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ExternalEmailLabel>>;
    userRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    service = new UnifiedInboxService(providerRepo, messageRepo, labelRepo, userRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps ExternalEmailMessage rows into EmailThread summaries', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      type: 'GMAIL',
    } as any);
    const queryBuilderMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'm1',
          userId,
          providerId,
          externalMessageId: 'ext-1',
          threadId: 'thread-1',
          from: 'Alice <alice@example.com>',
          to: ['you@example.com'],
          subject: 'Hello',
          snippet: 'Hi there',
          internalDate: new Date('2024-01-01T00:00:00.000Z'),
          labels: ['INBOX', 'UNREAD'],
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ]),
    };
    messageRepo.createQueryBuilder.mockReturnValue(queryBuilderMock as any);

    const threads = await service.listThreads(
      userId,
      10,
      0,
      { providerId, folder: 'inbox' } as any,
      null,
    );

    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: 'thread-1',
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

  it('updates labels locally for non-gmail providers', async () => {
    userRepo.findOne.mockResolvedValue({
      id: userId,
      activeInboxType: 'PROVIDER',
      activeInboxId: providerId,
    } as any);
    providerRepo.findOne
      .mockResolvedValueOnce({
        id: providerId,
        userId,
        type: 'CUSTOM_SMTP',
      } as any)
      .mockResolvedValueOnce({
        id: providerId,
        userId,
        type: 'CUSTOM_SMTP',
      } as any);
    const existingMessage = {
      id: 'm1',
      userId,
      providerId,
      externalMessageId: 'ext-1',
      threadId: 'thread-1',
      labels: ['INBOX', 'UNREAD'],
      createdAt: new Date(),
      internalDate: new Date(),
    } as any;
    const queryBuilderMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existingMessage),
    };
    messageRepo.createQueryBuilder.mockReturnValue(queryBuilderMock as any);
    messageRepo.find.mockResolvedValue([existingMessage]);
    messageRepo.update.mockResolvedValue({} as any);
    jest.spyOn(service, 'getThread').mockResolvedValue({
      id: 'thread-1',
      subject: 'Hello',
      participants: [],
      lastMessageDate: new Date().toISOString(),
      isUnread: false,
      messages: [],
      folder: 'archive',
      labelIds: [],
      providerId,
    } as any);

    await service.updateThread(userId, 'thread-1', {
      read: true,
      starred: true,
      folder: 'archive',
    } as any);

    expect(messageRepo.find).toHaveBeenCalled();
    expect(messageRepo.update).toHaveBeenCalledWith(
      { id: 'm1' },
      { labels: expect.any(Array) },
    );
  });
});
