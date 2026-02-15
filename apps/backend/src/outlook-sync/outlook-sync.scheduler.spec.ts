/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Repository, UpdateResult } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { OutlookSyncScheduler } from './outlook-sync.scheduler';
import { OutlookSyncService } from './outlook-sync.service';

describe('OutlookSyncScheduler', () => {
  let scheduler: OutlookSyncScheduler;
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let outlookSync: jest.Mocked<
    Pick<
      OutlookSyncService,
      'syncOutlookProvider' | 'ensurePushSubscriptionForProvider'
    >
  >;
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
    outlookSync = {
      syncOutlookProvider: jest.fn(),
      ensurePushSubscriptionForProvider: jest.fn().mockResolvedValue(true),
    };
    providerSyncLease = {
      acquireProviderSyncLease: jest.fn().mockResolvedValue(true),
    };
    notificationEventBus = {
      publishSafely: jest.fn(),
    };

    scheduler = new OutlookSyncScheduler(
      providerRepo,
      outlookSync as unknown as OutlookSyncService,
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
    outlookSync.syncOutlookProvider.mockRejectedValue(new Error('sync failed'));
    providerRepo.update.mockResolvedValue({} as UpdateResult);
    notificationEventBus.publishSafely.mockResolvedValue(null);

    await scheduler.syncActiveOutlookProviders();

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
    expect(providerRepo.update).toHaveBeenCalledWith(
      { id: 'provider-1' },
      expect.objectContaining({
        status: 'error',
        syncLeaseExpiresAt: null,
        lastSyncError: 'sync failed',
        lastSyncErrorAt: expect.any(Date),
      }),
    );
  });

  it('skips provider sync when lease is already active', async () => {
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      } as EmailProvider,
    ]);
    providerSyncLease.acquireProviderSyncLease.mockResolvedValue(false);

    await scheduler.syncActiveOutlookProviders();

    expect(outlookSync.syncOutlookProvider).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('retries Outlook sync before final failure', async () => {
    process.env.OUTLOOK_SYNC_SCHEDULER_RETRIES = '2';
    process.env.OUTLOOK_SYNC_SCHEDULER_RETRY_BACKOFF_MS = '50';
    process.env.OUTLOOK_SYNC_SCHEDULER_JITTER_MS = '0';
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      } as EmailProvider,
    ]);
    outlookSync.syncOutlookProvider
      .mockRejectedValueOnce(new Error('attempt-1'))
      .mockResolvedValueOnce({ imported: 1 } as never);

    await scheduler.syncActiveOutlookProviders();

    expect(outlookSync.syncOutlookProvider).toHaveBeenCalledTimes(2);
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('refreshes push subscriptions when notification url is configured', async () => {
    process.env.OUTLOOK_PUSH_NOTIFICATION_URL =
      'https://mailzen.example.com/outlook-sync/webhooks/push';
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      } as EmailProvider,
    ]);

    await scheduler.refreshOutlookPushSubscriptions();

    expect(outlookSync.ensurePushSubscriptionForProvider).toHaveBeenCalledWith(
      'provider-1',
      'user-1',
    );
  });

  it('skips push subscription refresh when webhook url is not configured', async () => {
    delete process.env.OUTLOOK_PUSH_NOTIFICATION_URL;

    await scheduler.refreshOutlookPushSubscriptions();

    expect(providerRepo.find).not.toHaveBeenCalled();
    expect(
      outlookSync.ensurePushSubscriptionForProvider,
    ).not.toHaveBeenCalled();
  });
});
