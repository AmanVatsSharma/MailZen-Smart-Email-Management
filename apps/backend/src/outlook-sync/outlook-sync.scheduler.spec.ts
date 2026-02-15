import { Repository, UpdateResult } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { NotificationService } from '../notification/notification.service';
import { OutlookSyncScheduler } from './outlook-sync.scheduler';
import { OutlookSyncService } from './outlook-sync.service';

describe('OutlookSyncScheduler', () => {
  let scheduler: OutlookSyncScheduler;
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let outlookSync: jest.Mocked<Pick<OutlookSyncService, 'syncOutlookProvider'>>;
  let notificationService: jest.Mocked<
    Pick<NotificationService, 'createNotification'>
  >;

  beforeEach(() => {
    providerRepo = {
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    outlookSync = {
      syncOutlookProvider: jest.fn(),
    };
    notificationService = {
      createNotification: jest.fn(),
    };

    scheduler = new OutlookSyncScheduler(
      providerRepo,
      outlookSync as unknown as OutlookSyncService,
      notificationService as unknown as NotificationService,
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
    outlookSync.syncOutlookProvider.mockRejectedValue(new Error('sync failed'));
    providerRepo.update.mockResolvedValue({} as UpdateResult);
    notificationService.createNotification.mockResolvedValue(
      {} as UserNotification,
    );

    await scheduler.syncActiveOutlookProviders();

    const notificationCallPayload = notificationService.createNotification.mock
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
