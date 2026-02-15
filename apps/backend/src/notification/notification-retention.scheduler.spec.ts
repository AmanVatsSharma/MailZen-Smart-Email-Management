import { NotificationService } from './notification.service';
import { NotificationRetentionScheduler } from './notification-retention.scheduler';

describe('NotificationRetentionScheduler', () => {
  const purgeNotificationRetentionDataMock = jest.fn();
  const notificationServiceMock: jest.Mocked<
    Pick<NotificationService, 'purgeNotificationRetentionData'>
  > = {
    purgeNotificationRetentionData: purgeNotificationRetentionDataMock,
  };
  const scheduler = new NotificationRetentionScheduler(
    notificationServiceMock as unknown as NotificationService,
  );
  const originalAutoPurgeEnv =
    process.env.MAILZEN_NOTIFICATION_RETENTION_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MAILZEN_NOTIFICATION_RETENTION_AUTOPURGE_ENABLED;
  });

  afterAll(() => {
    if (typeof originalAutoPurgeEnv === 'string') {
      process.env.MAILZEN_NOTIFICATION_RETENTION_AUTOPURGE_ENABLED =
        originalAutoPurgeEnv;
      return;
    }
    delete process.env.MAILZEN_NOTIFICATION_RETENTION_AUTOPURGE_ENABLED;
  });

  it('executes retention purge when auto-purge is enabled', async () => {
    purgeNotificationRetentionDataMock.mockResolvedValue({
      notificationsDeleted: 4,
      pushSubscriptionsDeleted: 2,
      notificationRetentionDays: 180,
      disabledPushRetentionDays: 90,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await scheduler.purgeRetentionData();

    expect(purgeNotificationRetentionDataMock).toHaveBeenCalledWith({});
  });

  it('skips retention purge when disabled by env flag', async () => {
    process.env.MAILZEN_NOTIFICATION_RETENTION_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeRetentionData();

    expect(purgeNotificationRetentionDataMock).not.toHaveBeenCalled();
  });
});
