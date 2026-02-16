/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
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
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
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
    auditLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
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
      auditLogRepo,
      mailboxSyncService as unknown as MailboxSyncService,
      emailProviderService as unknown as EmailProviderService,
    );
    auditLogRepo.create.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    auditLogRepo.save.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
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
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'inbox_active_source_updated',
      }),
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
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'inbox_sync_requested',
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

  it('continues inbox sync response when audit log persistence fails', async () => {
    mailboxSyncService.pollUserMailboxes.mockResolvedValue({
      polledMailboxes: 1,
      skippedMailboxes: 0,
      failedMailboxes: 0,
      fetchedMessages: 1,
      acceptedMessages: 1,
      deduplicatedMessages: 0,
      rejectedMessages: 0,
    });
    emailProviderService.syncUserProviders.mockResolvedValue({
      requestedProviders: 1,
      syncedProviders: 1,
      failedProviders: 0,
      skippedProviders: 0,
      results: [],
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });
    auditLogRepo.save.mockRejectedValue(
      new Error('audit datastore unavailable'),
    );

    await expect(
      service.syncUserInboxes({
        userId: 'user-1',
        workspaceId: null,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it('returns workspace health stats with status buckets', async () => {
    const recentSyncTime = new Date(Date.now() - 10 * 60 * 1000);
    const recentErrorTime = new Date(Date.now() - 15 * 60 * 1000);
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: 'workspace-1',
      activeInboxType: 'MAILBOX',
      activeInboxId: 'mailbox-syncing',
    } as User);
    mailboxRepo.find.mockResolvedValue([
      {
        id: 'mailbox-syncing',
        status: 'ACTIVE',
        inboundSyncStatus: 'syncing',
        inboundSyncLastPolledAt: recentSyncTime,
      },
      {
        id: 'mailbox-error',
        status: 'ACTIVE',
        inboundSyncStatus: 'error',
        inboundSyncLastErrorAt: recentErrorTime,
      },
      {
        id: 'mailbox-disabled',
        status: 'DISABLED',
      },
    ] as Mailbox[]);
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-active',
        status: 'connected',
        lastSyncedAt: recentSyncTime,
      },
      {
        id: 'provider-error',
        status: 'error',
        lastSyncErrorAt: recentErrorTime,
      },
    ] as EmailProvider[]);

    const result = await service.getInboxSourceHealthStats({
      userId: 'user-1',
      workspaceId: undefined,
      windowHours: 24,
    });

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
    expect(result).toEqual(
      expect.objectContaining({
        totalInboxes: 5,
        mailboxInboxes: 3,
        providerInboxes: 2,
        activeInboxes: 1,
        connectedInboxes: 1,
        syncingInboxes: 1,
        errorInboxes: 2,
        disabledInboxes: 1,
        pendingInboxes: 0,
        recentlySyncedInboxes: 2,
        recentlyErroredInboxes: 2,
        windowHours: 24,
        workspaceId: 'workspace-1',
      }),
    );
  });

  it('clamps health stats window and supports explicit workspace override', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: 'workspace-1',
      activeInboxType: 'PROVIDER',
      activeInboxId: 'provider-2',
    } as User);
    mailboxRepo.find.mockResolvedValue([]);
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-2',
        status: 'connected',
      },
    ] as EmailProvider[]);

    const result = await service.getInboxSourceHealthStats({
      userId: 'user-1',
      workspaceId: 'workspace-2',
      windowHours: 0,
    });

    expect(mailboxRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-2' },
      }),
    );
    expect(result.windowHours).toBe(1);
    expect(result.workspaceId).toBe('workspace-2');
    expect(result.activeInboxes).toBe(1);
  });
});
