import { Repository, UpdateResult } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { GmailSyncScheduler } from './gmail-sync.scheduler';
import { GmailSyncService } from './gmail-sync.service';

describe('GmailSyncScheduler', () => {
  let scheduler: GmailSyncScheduler;
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let gmailSync: jest.Mocked<Pick<GmailSyncService, 'syncGmailProvider'>>;
  let providerSyncLease: jest.Mocked<
    Pick<ProviderSyncLeaseService, 'acquireProviderSyncLease'>
  >;
  let notificationEventBus: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  >;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    providerRepo = {
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    gmailSync = {
      syncGmailProvider: jest.fn(),
    };
    providerSyncLease = {
      acquireProviderSyncLease: jest.fn().mockResolvedValue(true),
    };
    notificationEventBus = {
      publishSafely: jest.fn(),
    };

    scheduler = new GmailSyncScheduler(
      providerRepo,
      gmailSync as unknown as GmailSyncService,
      providerSyncLease as unknown as ProviderSyncLeaseService,
      notificationEventBus as unknown as NotificationEventBusService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('attaches workspace metadata when sync fails', async () => {
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      } as EmailProvider,
    ]);
    gmailSync.syncGmailProvider.mockRejectedValue(new Error('sync failed'));
    providerRepo.update.mockResolvedValue({} as UpdateResult);
    notificationEventBus.publishSafely.mockResolvedValue(null);

    await scheduler.syncActiveGmailProviders();

    const notificationCallPayload = notificationEventBus.publishSafely.mock
      .calls[0]?.[0] as {
      userId: string;
      type: string;
      metadata?: Record<string, unknown>;
    };
    expect(notificationCallPayload.userId).toBe('user-1');
    expect(notificationCallPayload.type).toBe('SYNC_FAILED');
    expect(notificationCallPayload.metadata?.providerId).toBe('provider-1');
    expect(notificationCallPayload.metadata?.workspaceId).toBe('workspace-1');
    expect(notificationCallPayload.metadata?.attempts).toBe(2);
  });

  it('skips provider sync when lease cannot be acquired', async () => {
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      } as EmailProvider,
    ]);
    providerSyncLease.acquireProviderSyncLease.mockResolvedValue(false);

    await scheduler.syncActiveGmailProviders();

    expect(gmailSync.syncGmailProvider).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('retries sync before marking final failure', async () => {
    process.env.GMAIL_SYNC_SCHEDULER_RETRIES = '2';
    process.env.GMAIL_SYNC_SCHEDULER_RETRY_BACKOFF_MS = '50';
    process.env.GMAIL_SYNC_SCHEDULER_JITTER_MS = '0';

    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      } as EmailProvider,
    ]);
    gmailSync.syncGmailProvider
      .mockRejectedValueOnce(new Error('attempt-1'))
      .mockResolvedValueOnce({ imported: 1 } as never);

    await scheduler.syncActiveGmailProviders();

    expect(gmailSync.syncGmailProvider).toHaveBeenCalledTimes(2);
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });
});
