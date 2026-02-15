import { Repository, UpdateResult } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { GmailSyncScheduler } from './gmail-sync.scheduler';
import { GmailSyncService } from './gmail-sync.service';

describe('GmailSyncScheduler', () => {
  let scheduler: GmailSyncScheduler;
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let gmailSync: jest.Mocked<Pick<GmailSyncService, 'syncGmailProvider'>>;
  let notificationEventBus: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  >;

  beforeEach(() => {
    providerRepo = {
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    gmailSync = {
      syncGmailProvider: jest.fn(),
    };
    notificationEventBus = {
      publishSafely: jest.fn(),
    };

    scheduler = new GmailSyncScheduler(
      providerRepo,
      gmailSync as unknown as GmailSyncService,
      notificationEventBus as unknown as NotificationEventBusService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
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
  });
});
