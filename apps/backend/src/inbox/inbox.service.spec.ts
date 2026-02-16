/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { User } from '../user/entities/user.entity';
import { InboxService } from './inbox.service';

describe('InboxService', () => {
  let service: InboxService;
  let userRepo: jest.Mocked<Repository<User>>;
  let mailboxRepo: jest.Mocked<Repository<Mailbox>>;
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    mailboxRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Mailbox>>;
    providerRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;

    service = new InboxService(userRepo, mailboxRepo, providerRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists inboxes scoped to active workspace', async () => {
    const mailboxLastPolledAt = new Date('2026-02-16T00:00:00.000Z');
    const providerLastSyncedAt = new Date('2026-02-16T00:05:00.000Z');
    const providerLastSyncErrorAt = new Date('2026-02-16T00:06:00.000Z');
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: 'workspace-1',
      activeInboxType: 'PROVIDER',
      activeInboxId: 'provider-1',
    } as User);
    mailboxRepo.find.mockResolvedValue([
      {
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
        status: 'ACTIVE',
        inboundSyncLastPolledAt: mailboxLastPolledAt,
        inboundSyncLastError: null,
      },
    ] as Mailbox[]);
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-1',
        email: 'founder@gmail.com',
        status: 'connected',
        type: 'GMAIL',
        lastSyncedAt: providerLastSyncedAt,
        lastSyncError: 'temporary issue',
        lastSyncErrorAt: providerLastSyncErrorAt,
      },
    ] as EmailProvider[]);

    const result = await service.listUserInboxes('user-1');

    expect(mailboxRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-1' },
      }),
    );
    expect(providerRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-1' },
      }),
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'mailbox-1',
          syncStatus: 'connected',
          lastSyncedAt: mailboxLastPolledAt,
          sourceKind: 'MAILBOX',
        }),
        expect.objectContaining({
          id: 'provider-1',
          syncStatus: 'connected',
          lastSyncedAt: providerLastSyncedAt,
          lastSyncErrorAt: providerLastSyncErrorAt,
          sourceKind: 'GMAIL',
        }),
      ]),
    );
  });

  it('marks mailbox sync status as error when sync error exists', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: null,
      activeInboxType: 'MAILBOX',
      activeInboxId: 'mailbox-1',
    } as unknown as User);
    mailboxRepo.find.mockResolvedValue([
      {
        id: 'mailbox-1',
        email: 'ops@mailzen.com',
        status: 'ACTIVE',
        inboundSyncLastError: 'mail transport unavailable',
        inboundSyncLastErrorAt: new Date('2026-02-16T01:00:00.000Z'),
      },
    ] as Mailbox[]);
    providerRepo.find.mockResolvedValue([]);

    const result = await service.listUserInboxes('user-1');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'mailbox-1',
        syncStatus: 'error',
        lastSyncError: 'mail transport unavailable',
        lastSyncErrorAt: new Date('2026-02-16T01:00:00.000Z'),
      }),
    ]);
  });

  it('scopes active provider update to active workspace', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: 'workspace-1',
    } as User);
    providerRepo.findOne.mockResolvedValue({
      id: 'provider-1',
      email: 'founder@gmail.com',
      status: 'connected',
    } as EmailProvider);
    providerRepo.update.mockResolvedValue({} as never);
    userRepo.update.mockResolvedValue({} as never);
    mailboxRepo.find.mockResolvedValue([]);
    providerRepo.find.mockResolvedValue([]);

    await service.setActiveInbox('user-1', 'PROVIDER', 'provider-1');

    expect(providerRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'provider-1', userId: 'user-1', workspaceId: 'workspace-1' },
    });
    expect(providerRepo.update).toHaveBeenCalledWith(
      { userId: 'user-1', workspaceId: 'workspace-1' },
      { isActive: false },
    );
  });

  it('throws when mailbox is not in active workspace', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: 'workspace-1',
    } as User);
    mailboxRepo.findOne.mockResolvedValue(null);

    await expect(
      service.setActiveInbox('user-1', 'MAILBOX', 'mailbox-unknown'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
