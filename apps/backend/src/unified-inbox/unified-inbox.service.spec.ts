import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { Email } from '../email/entities/email.entity';
import { EmailLabel } from '../email/entities/email-label.entity';
import { EmailLabelAssignment } from '../email/entities/email-label-assignment.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { User } from '../user/entities/user.entity';
import { UnifiedInboxService } from './unified-inbox.service';

describe('UnifiedInboxService', () => {
  const userId = 'user-1';
  const providerId = 'provider-1';

  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let messageRepo: jest.Mocked<Repository<ExternalEmailMessage>>;
  let labelRepo: jest.Mocked<Repository<ExternalEmailLabel>>;
  let emailLabelRepo: jest.Mocked<Repository<EmailLabel>>;
  let emailLabelAssignmentRepo: jest.Mocked<Repository<EmailLabelAssignment>>;
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
    emailLabelRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailLabel>>;
    emailLabelAssignmentRepo = {
      find: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailLabelAssignment>>;
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
      emailLabelAssignmentRepo,
      emailLabelRepo,
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

  it('scopes mailbox thread list to mailboxId when mailbox linkage exists', async () => {
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
        mailboxId: 'mailbox-1',
        subject: 'Scoped message',
        body: '<p>Scoped body</p>',
        from: 'client@example.com',
        to: ['sales@mailzen.com'],
        status: 'UNREAD',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:00:00.000Z'),
        updatedAt: new Date('2026-02-15T10:00:00.000Z'),
      } as any,
      {
        id: 'mail-2',
        userId,
        mailboxId: 'mailbox-2',
        subject: 'Other mailbox message',
        body: '<p>Do not include</p>',
        from: 'client@example.com',
        to: ['sales@mailzen.com'],
        status: 'UNREAD',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:01:00.000Z'),
        updatedAt: new Date('2026-02-15T10:01:00.000Z'),
      } as any,
    ]);

    const threads = await service.listThreads(userId, 20, 0, null, null);

    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe('mail-1');
  });

  it('groups mailbox emails by inbound thread key in thread list', async () => {
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
        inboundThreadKey: 'thread-msg-1',
        inboundMessageId: '<msg-1@example.com>',
        subject: 'Warm welcome',
        body: '<p>Welcome to MailZen</p>',
        from: 'client@example.com',
        to: ['sales@mailzen.com'],
        status: 'READ',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:00:00.000Z'),
        updatedAt: new Date('2026-02-15T10:00:00.000Z'),
      } as any,
      {
        id: 'mail-2',
        userId,
        inboundThreadKey: 'thread-msg-1',
        inboundMessageId: '<msg-2@example.com>',
        subject: 'Re: Warm welcome',
        body: '<p>Thanks for sharing</p>',
        from: 'sales@mailzen.com',
        to: ['client@example.com'],
        status: 'UNREAD',
        isImportant: true,
        createdAt: new Date('2026-02-15T10:05:00.000Z'),
        updatedAt: new Date('2026-02-15T10:05:00.000Z'),
      } as any,
    ]);

    const threads = await service.listThreads(userId, 20, 0, null, null);

    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe('thread-msg-1');
    expect(threads[0].messages).toHaveLength(2);
    expect(threads[0].messages[1].providerEmailId).toBe('<msg-2@example.com>');
    expect(threads[0].isUnread).toBe(true);
  });

  it('returns mailbox thread details by inbound thread key', async () => {
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
        inboundThreadKey: 'thread-msg-9',
        inboundMessageId: '<msg-9a@example.com>',
        subject: 'Contract update',
        body: '<p>Initial draft</p>',
        from: 'ceo@example.com',
        to: ['sales@mailzen.com'],
        status: 'READ',
        isImportant: false,
        createdAt: new Date('2026-02-15T09:00:00.000Z'),
        updatedAt: new Date('2026-02-15T09:00:00.000Z'),
      } as any,
      {
        id: 'mail-2',
        userId,
        inboundThreadKey: 'thread-msg-9',
        inboundMessageId: '<msg-9b@example.com>',
        subject: 'Re: Contract update',
        body: '<p>Follow-up question</p>',
        from: 'sales@mailzen.com',
        to: ['ceo@example.com'],
        status: 'UNREAD',
        isImportant: false,
        createdAt: new Date('2026-02-15T09:30:00.000Z'),
        updatedAt: new Date('2026-02-15T09:30:00.000Z'),
      } as any,
    ]);

    const thread = await service.getThread(userId, 'thread-msg-9');

    expect(thread.id).toBe('thread-msg-9');
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[0].providerEmailId).toBe('<msg-9a@example.com>');
    expect(thread.messages[1].providerEmailId).toBe('<msg-9b@example.com>');
  });

  it('scopes requested provider resolution to active workspace', async () => {
    userRepo.findOne.mockResolvedValue({
      id: userId,
      activeWorkspaceId: 'workspace-1',
    } as any);
    providerRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: providerId,
      userId,
      workspaceId: null,
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
      getMany: jest.fn().mockResolvedValue([]),
    };
    messageRepo.createQueryBuilder.mockReturnValue(queryBuilderMock as any);

    const threads = await service.listThreads(
      userId,
      10,
      0,
      { providerId } as any,
      null,
    );

    expect(providerRepo.findOne).toHaveBeenNthCalledWith(1, {
      where: {
        id: providerId,
        userId,
        workspaceId: 'workspace-1',
      },
    });
    expect(providerRepo.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        id: providerId,
        userId,
        workspaceId: null,
      },
    });
    expect(threads).toEqual([]);
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
        inboundThreadKey: 'thread-msg-1',
        subject: 'Warm welcome',
        body: '<p>Welcome to MailZen</p>',
        from: 'client@example.com',
        to: ['sales@mailzen.com'],
        status: 'UNREAD',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:00:00.000Z'),
        updatedAt: new Date('2026-02-15T10:00:00.000Z'),
      } as any,
      {
        id: 'mail-2',
        userId,
        inboundThreadKey: 'thread-msg-1',
        subject: 'Re: Warm welcome',
        body: '<p>Follow-up note</p>',
        from: 'sales@mailzen.com',
        to: ['client@example.com'],
        status: 'UNREAD',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:02:00.000Z'),
        updatedAt: new Date('2026-02-15T10:02:00.000Z'),
      } as any,
    ]);
    jest.spyOn(service, 'getThread').mockResolvedValue({
      id: 'thread-msg-1',
      subject: 'Warm welcome',
      participants: [],
      lastMessageDate: new Date().toISOString(),
      isUnread: false,
      messages: [
        {
          id: 'mail-1',
          threadId: 'thread-msg-1',
          subject: 'Warm welcome',
          from: { name: 'client', email: 'client@example.com' },
          to: [{ name: 'sales', email: 'sales@mailzen.com' }],
          content: '<p>Welcome to MailZen</p>',
          contentPreview: 'Welcome to MailZen',
          date: new Date().toISOString(),
          folder: 'inbox',
          isStarred: true,
          importance: 'high',
          attachments: [],
          status: 'read',
          labelIds: [],
          providerId: 'mailbox-1',
          providerEmailId: 'mail-1',
        },
      ],
      folder: 'inbox',
      labelIds: [],
      providerId: 'mailbox-1',
    } as any);
    emailRepo.update.mockResolvedValue({} as any);
    emailLabelRepo.find.mockResolvedValue([]);

    const updated = await service.updateThread(userId, 'mail-1', {
      read: true,
      starred: true,
    } as any);

    expect(emailRepo.update).toHaveBeenNthCalledWith(
      1,
      { id: 'mail-1', userId },
      expect.objectContaining({
        status: 'READ',
        isImportant: true,
      }),
    );
    expect(emailRepo.update).toHaveBeenNthCalledWith(
      2,
      { id: 'mail-2', userId },
      expect.objectContaining({
        status: 'READ',
        isImportant: true,
      }),
    );
    expect(updated.messages[0].isStarred).toBe(true);
  });

  it('updates mailbox thread custom label assignments', async () => {
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
        inboundThreadKey: 'thread-msg-1',
        subject: 'Warm welcome',
        body: '<p>Welcome to MailZen</p>',
        from: 'client@example.com',
        to: ['sales@mailzen.com'],
        status: 'UNREAD',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:00:00.000Z'),
        updatedAt: new Date('2026-02-15T10:00:00.000Z'),
      } as any,
      {
        id: 'mail-2',
        userId,
        inboundThreadKey: 'thread-msg-1',
        subject: 'Re: Warm welcome',
        body: '<p>Follow-up note</p>',
        from: 'sales@mailzen.com',
        to: ['client@example.com'],
        status: 'READ',
        isImportant: false,
        createdAt: new Date('2026-02-15T10:02:00.000Z'),
        updatedAt: new Date('2026-02-15T10:02:00.000Z'),
      } as any,
    ]);
    emailLabelRepo.find.mockResolvedValue([
      { id: 'label-1', userId, name: 'VIP', color: '#22c55e' } as any,
      { id: 'label-2', userId, name: 'Follow-up', color: '#3b82f6' } as any,
    ]);
    emailRepo.update.mockResolvedValue({} as any);
    emailLabelAssignmentRepo.upsert.mockResolvedValue({} as any);
    emailLabelAssignmentRepo.delete.mockResolvedValue({} as any);
    jest.spyOn(service, 'getThread').mockResolvedValue({
      id: 'thread-msg-1',
      subject: 'Warm welcome',
      participants: [],
      lastMessageDate: new Date().toISOString(),
      isUnread: true,
      messages: [],
      folder: 'inbox',
      labelIds: ['label-1'],
      providerId: 'mailbox-1',
    } as any);

    await service.updateThread(userId, 'thread-msg-1', {
      addLabelIds: ['label-1'],
      removeLabelIds: ['label-2'],
    } as any);

    expect(emailLabelAssignmentRepo.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ emailId: 'mail-1', labelId: 'label-1' }),
        expect.objectContaining({ emailId: 'mail-2', labelId: 'label-1' }),
      ]),
      ['emailId', 'labelId'],
    );
    expect(emailLabelAssignmentRepo.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        emailId: expect.any(Object),
        labelId: expect.any(Object),
      }),
    );
  });

  it('returns mailbox labels from persisted label assignments', async () => {
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
        mailboxId: 'mailbox-1',
      } as any,
      {
        id: 'mail-2',
        userId,
        mailboxId: 'mailbox-1',
      } as any,
    ]);
    emailLabelAssignmentRepo.find.mockResolvedValue([
      { emailId: 'mail-1', labelId: 'label-1' } as any,
      { emailId: 'mail-2', labelId: 'label-1' } as any,
      { emailId: 'mail-2', labelId: 'label-2' } as any,
    ]);
    emailLabelRepo.find.mockResolvedValue([
      { id: 'label-1', userId, name: 'VIP', color: '#22c55e' } as any,
      { id: 'label-2', userId, name: 'Finance', color: '#0ea5e9' } as any,
    ]);

    const labels = await service.listLabels(userId);

    expect(labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'label-1',
          name: 'VIP',
          color: '#22c55e',
          count: 2,
        }),
        expect.objectContaining({
          id: 'label-2',
          name: 'Finance',
          color: '#0ea5e9',
          count: 1,
        }),
      ]),
    );
  });
});
