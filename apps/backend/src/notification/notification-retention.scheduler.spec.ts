import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { NotificationService } from './notification.service';
import { NotificationRetentionScheduler } from './notification-retention.scheduler';

describe('NotificationRetentionScheduler', () => {
  const schedulerActorUserId = 'system:notification-retention-scheduler';
  const purgeNotificationRetentionDataMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();
  const notificationServiceMock: jest.Mocked<
    Pick<NotificationService, 'purgeNotificationRetentionData'>
  > = {
    purgeNotificationRetentionData: purgeNotificationRetentionDataMock,
  };
  const auditLogRepoMock: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>> =
    {
      create: createAuditLogMock,
      save: saveAuditLogMock,
    };
  const scheduler = new NotificationRetentionScheduler(
    notificationServiceMock as unknown as NotificationService,
    auditLogRepoMock as unknown as Repository<AuditLog>,
  );
  const originalAutoPurgeEnv =
    process.env.MAILZEN_NOTIFICATION_RETENTION_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLogMock.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
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

    expect(purgeNotificationRetentionDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'notification_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'notification_retention_autopurge_completed',
      }),
    );
  });

  it('skips retention purge when disabled by env flag', async () => {
    process.env.MAILZEN_NOTIFICATION_RETENTION_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeRetentionData();

    expect(purgeNotificationRetentionDataMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'notification_retention_autopurge_skipped',
      }),
    );
  });

  it('records failed autopurge audit action when retention purge throws', async () => {
    purgeNotificationRetentionDataMock.mockRejectedValue(
      new Error('retention purge failed'),
    );

    await scheduler.purgeRetentionData();

    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'notification_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'notification_retention_autopurge_failed',
        metadata: expect.objectContaining({
          error: 'retention purge failed',
        }),
      }),
    );
  });

  it('continues purge flow when scheduler audit writes fail', async () => {
    saveAuditLogMock.mockRejectedValue(new Error('audit datastore unavailable'));
    purgeNotificationRetentionDataMock.mockResolvedValue({
      notificationsDeleted: 1,
      pushSubscriptionsDeleted: 1,
      notificationRetentionDays: 180,
      disabledPushRetentionDays: 90,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await expect(scheduler.purgeRetentionData()).resolves.toBeUndefined();

    expect(purgeNotificationRetentionDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
  });
});
