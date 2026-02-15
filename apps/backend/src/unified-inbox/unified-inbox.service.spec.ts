import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { Email } from '../email/entities/email.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { User } from '../user/entities/user.entity';
import { UnifiedInboxService } from './unified-inbox.service';

describe('UnifiedInboxService', () => {
  const userId = 'user-1';
  const providerId = 'provider-1';

  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let messageRepo: jest.Mocked<Repository<ExternalEmailMessage>>;
  let labelRepo: jest.Mocked<Repository<ExternalEmailLabel>>;
  let emailRepo: jest.Mocked<Repository<Email>>;
  let mailboxRepo: jest.Mocked<Repository<Mailbox>>;
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
    emailRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Email>>;
    mailboxRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Mailbox>>;
    userRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    service = new UnifiedInboxService(
      providerRepo,
      messageRepo,
      labelRepo,
      emailRepo,
      mailboxRepo,
      userRepo,
    );
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

  it('returns mailbox-sourced threads when active inbox is MAILBOX', async () => {
    userRepo.findOne.mockResolvedValue({
      id: userId,
      activeInboxType: 'MAILBOX',
      activeInboxId: 'mailbox-1',
    } as any);
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId,
      email: 'sales@mailzen.com',
    } as any);
    emailRepo.find.mockResolvedValue([
      {
        id: 'mail-1',
        userId,
        subject: 'Warm welcome',
        body: '<p>Welcome to MailZen</p>',
        from: 'client@example.com',
        to: ['sales@mailzen.com'],
        status: 'UNREAD',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:00:00.000Z'),
        updatedAt: new Date('2026-02-15T10:00:00.000Z'),
      } as any,
    ]);

    const threads = await service.listThreads(userId, 20, 0, null, null);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: 'mail-1',
      folder: 'inbox',
      isUnread: true,
      providerId: 'mailbox-1',
    });
  });

  it('updates mailbox thread read/star state locally', async () => {
    userRepo.findOne.mockResolvedValue({
      id: userId,
      activeInboxType: 'MAILBOX',
      activeInboxId: 'mailbox-1',
    } as any);
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId,
      email: 'sales@mailzen.com',
    } as any);
    emailRepo.find.mockResolvedValue([
      {
        id: 'mail-1',
        userId,
        subject: 'Warm welcome',
        body: '<p>Welcome to MailZen</p>',
        from: 'client@example.com',
        to: ['sales@mailzen.com'],
        status: 'UNREAD',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:00:00.000Z'),
        updatedAt: new Date('2026-02-15T10:00:00.000Z'),
      } as any,
    ]);
    emailRepo.findOne.mockResolvedValue({
      id: 'mail-1',
      userId,
      subject: 'Warm welcome',
      body: '<p>Welcome to MailZen</p>',
      from: 'client@example.com',
      to: ['sales@mailzen.com'],
      status: 'READ',
      isImportant: true,
      createdAt: new Date('2026-02-15T10:00:00.000Z'),
      updatedAt: new Date('2026-02-15T10:05:00.000Z'),
    } as any);
    emailRepo.update.mockResolvedValue({} as any);

    const updated = await service.updateThread(userId, 'mail-1', {
      read: true,
      starred: true,
    } as any);

    expect(emailRepo.update).toHaveBeenCalledWith(
      { id: 'mail-1', userId },
      expect.objectContaining({
        status: 'READ',
        isImportant: true,
      }),
    );
    expect(updated.messages[0].isStarred).toBe(true);
  });
});
