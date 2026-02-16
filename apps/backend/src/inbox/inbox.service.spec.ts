/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailProviderService } from '../email-integration/email-provider.service';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { MailboxSyncService } from '../mailbox/mailbox-sync.service';
import { User } from '../user/entities/user.entity';
import { InboxService } from './inbox.service';

describe('InboxService', () => {
  let service: InboxService;
  let userRepo: jest.Mocked<Repository<User>>;
  let mailboxRepo: jest.Mocked<Repository<Mailbox>>;
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let mailboxSyncService: jest.Mocked<
    Pick<MailboxSyncService, 'pollUserMailboxes'>
  >;
  let emailProviderService: jest.Mocked<
    Pick<EmailProviderService, 'syncUserProviders'>
  >;

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
    mailboxSyncService = {
      pollUserMailboxes: jest.fn(),
    };
    emailProviderService = {
      syncUserProviders: jest.fn(),
    };

    service = new InboxService(
      userRepo,
      mailboxRepo,
      providerRepo,
      mailboxSyncService as unknown as MailboxSyncService,
      emailProviderService as unknown as EmailProviderService,
    );
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

  it('syncs mailbox and provider sources for workspace scope', async () => {
    mailboxSyncService.pollUserMailboxes.mockResolvedValue({
      polledMailboxes: 2,
      skippedMailboxes: 1,
      failedMailboxes: 0,
      fetchedMessages: 10,
      acceptedMessages: 8,
      deduplicatedMessages: 2,
      rejectedMessages: 0,
    });
    emailProviderService.syncUserProviders.mockResolvedValue({
      requestedProviders: 3,
      syncedProviders: 2,
      failedProviders: 1,
      skippedProviders: 0,
      results: [],
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await service.syncUserInboxes({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    expect(mailboxSyncService.pollUserMailboxes).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
    expect(emailProviderService.syncUserProviders).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
    expect(result).toEqual(
      expect.objectContaining({
        mailboxPolledMailboxes: 2,
        providerRequestedProviders: 3,
        success: true,
      }),
    );
  });

  it('returns partial result when provider sync fails', async () => {
    mailboxSyncService.pollUserMailboxes.mockResolvedValue({
      polledMailboxes: 1,
      skippedMailboxes: 0,
      failedMailboxes: 0,
      fetchedMessages: 1,
      acceptedMessages: 1,
      deduplicatedMessages: 0,
      rejectedMessages: 0,
    });
    emailProviderService.syncUserProviders.mockRejectedValue(
      new Error('provider backend unavailable'),
    );

    const result = await service.syncUserInboxes({
      userId: 'user-1',
      workspaceId: null,
    });

    expect(result.success).toBe(false);
    expect(result.providerSyncError).toContain('provider backend unavailable');
    expect(result.mailboxPolledMailboxes).toBe(1);
  });
});
