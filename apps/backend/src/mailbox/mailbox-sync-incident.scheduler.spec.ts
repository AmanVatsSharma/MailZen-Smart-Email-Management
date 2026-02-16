/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Repository } from 'typeorm';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { UserNotificationPreference } from '../notification/entities/user-notification-preference.entity';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { NotificationService } from '../notification/notification.service';
import { MailboxSyncIncidentScheduler } from './mailbox-sync-incident.scheduler';
import { MailboxSyncRun } from './entities/mailbox-sync-run.entity';
import { MailboxSyncService } from './mailbox-sync.service';

describe('MailboxSyncIncidentScheduler', () => {
  let scheduler: MailboxSyncIncidentScheduler;
  let mailboxSyncRunRepo: jest.Mocked<Repository<MailboxSyncRun>>;
  let notificationRepo: jest.Mocked<Repository<UserNotification>>;
  let mailboxSyncService: jest.Mocked<
    Pick<MailboxSyncService, 'getMailboxSyncIncidentStatsForUser'>
  >;
  let notificationService: jest.Mocked<
    Pick<NotificationService, 'getOrCreatePreferences'>
  >;
  let notificationEventBus: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  >;
  const originalIncidentAlertsEnabledEnv =
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERTS_ENABLED;
  const originalWindowHoursEnv =
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WINDOW_HOURS;
  const originalCooldownMinutesEnv =
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_COOLDOWN_MINUTES;
  const originalMaxUsersPerRunEnv =
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MAX_USERS_PER_RUN;
  const originalWarningRateEnv =
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WARNING_RATE_PERCENT;
  const originalCriticalRateEnv =
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_CRITICAL_RATE_PERCENT;
  const originalMinIncidentRunsEnv =
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MIN_INCIDENT_RUNS;

  beforeEach(() => {
    delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERTS_ENABLED;
    delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WINDOW_HOURS;
    delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_COOLDOWN_MINUTES;
    delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MAX_USERS_PER_RUN;
    delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WARNING_RATE_PERCENT;
    delete process.env
      .MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_CRITICAL_RATE_PERCENT;
    delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MIN_INCIDENT_RUNS;
    mailboxSyncRunRepo = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<MailboxSyncRun>>;
    notificationRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotification>>;
    mailboxSyncService = {
      getMailboxSyncIncidentStatsForUser: jest.fn(),
    };
    notificationService = {
      getOrCreatePreferences: jest.fn(),
    };
    notificationEventBus = {
      publishSafely: jest.fn(),
    };
    mailboxSyncRunRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }]),
    } as any);
    notificationRepo.findOne.mockResolvedValue(null);
    notificationEventBus.publishSafely.mockResolvedValue(null);

    scheduler = new MailboxSyncIncidentScheduler(
      mailboxSyncRunRepo,
      notificationRepo,
      mailboxSyncService as unknown as MailboxSyncService,
      notificationService as unknown as NotificationService,
      notificationEventBus as unknown as NotificationEventBusService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (typeof originalIncidentAlertsEnabledEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERTS_ENABLED =
        originalIncidentAlertsEnabledEnv;
      return;
    }
    delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERTS_ENABLED;
    if (typeof originalWindowHoursEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WINDOW_HOURS =
        originalWindowHoursEnv;
    } else {
      delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WINDOW_HOURS;
    }
    if (typeof originalCooldownMinutesEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_COOLDOWN_MINUTES =
        originalCooldownMinutesEnv;
    } else {
      delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_COOLDOWN_MINUTES;
    }
    if (typeof originalMaxUsersPerRunEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MAX_USERS_PER_RUN =
        originalMaxUsersPerRunEnv;
    } else {
      delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MAX_USERS_PER_RUN;
    }
    if (typeof originalWarningRateEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WARNING_RATE_PERCENT =
        originalWarningRateEnv;
    } else {
      delete process.env
        .MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WARNING_RATE_PERCENT;
    }
    if (typeof originalCriticalRateEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_CRITICAL_RATE_PERCENT =
        originalCriticalRateEnv;
    } else {
      delete process.env
        .MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_CRITICAL_RATE_PERCENT;
    }
    if (typeof originalMinIncidentRunsEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MIN_INCIDENT_RUNS =
        originalMinIncidentRunsEnv;
    } else {
      delete process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MIN_INCIDENT_RUNS;
    }
  });

  const basePreference = {
    id: 'pref-1',
    userId: 'user-1',
    syncFailureEnabled: true,
    mailboxInboundSlaAlertCooldownMinutes: 60,
  } as UserNotificationPreference;

  const criticalIncidentStats = {
    windowHours: 24,
    totalRuns: 20,
    incidentRuns: 8,
    failedRuns: 4,
    partialRuns: 4,
    incidentRatePercent: 40,
    lastIncidentAtIso: '2026-02-16T00:30:00.000Z',
  };

  it('emits mailbox sync incident alert for critical status', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue(
      basePreference,
    );
    mailboxSyncService.getMailboxSyncIncidentStatsForUser.mockResolvedValue(
      criticalIncidentStats as any,
    );

    await scheduler.monitorMailboxSyncIncidents();

    expect(
      mailboxSyncService.getMailboxSyncIncidentStatsForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      windowHours: 24,
    });
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'MAILBOX_SYNC_INCIDENT_ALERT',
      }),
    );
  });

  it('suppresses duplicate incident alert during cooldown', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue(
      basePreference,
    );
    mailboxSyncService.getMailboxSyncIncidentStatsForUser.mockResolvedValue(
      criticalIncidentStats as any,
    );
    notificationRepo.findOne.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'MAILBOX_SYNC_INCIDENT_ALERT',
      metadata: {
        incidentStatus: 'CRITICAL',
      },
      createdAt: new Date(),
    } as unknown as UserNotification);

    await scheduler.monitorMailboxSyncIncidents();

    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('emits incident alert when status escalates inside cooldown', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue(
      basePreference,
    );
    mailboxSyncService.getMailboxSyncIncidentStatsForUser.mockResolvedValue(
      criticalIncidentStats as any,
    );
    notificationRepo.findOne.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'MAILBOX_SYNC_INCIDENT_ALERT',
      metadata: {
        incidentStatus: 'WARNING',
      },
      createdAt: new Date(),
    } as unknown as UserNotification);

    await scheduler.monitorMailboxSyncIncidents();

    expect(notificationEventBus.publishSafely).toHaveBeenCalledTimes(1);
  });

  it('skips incident alerts when sync-failure preference is disabled', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...basePreference,
      syncFailureEnabled: false,
    } as UserNotificationPreference);

    await scheduler.monitorMailboxSyncIncidents();

    expect(
      mailboxSyncService.getMailboxSyncIncidentStatsForUser,
    ).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('skips monitoring when incident alerts are disabled by env', async () => {
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERTS_ENABLED = 'false';

    await scheduler.monitorMailboxSyncIncidents();

    expect(
      mailboxSyncService.getMailboxSyncIncidentStatsForUser,
    ).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('returns resolved incident alert config snapshot', () => {
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERTS_ENABLED = 'true';
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WINDOW_HOURS = '48';
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_COOLDOWN_MINUTES = '120';
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MAX_USERS_PER_RUN = '250';
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WARNING_RATE_PERCENT =
      '7.5';
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_CRITICAL_RATE_PERCENT =
      '19.5';
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MIN_INCIDENT_RUNS = '3';

    const config = scheduler.getIncidentAlertConfigSnapshot();

    expect(config.alertsEnabled).toBe(true);
    expect(config.windowHours).toBe(48);
    expect(config.cooldownMinutes).toBe(120);
    expect(config.maxUsersPerRun).toBe(250);
    expect(config.warningRatePercent).toBe(7.5);
    expect(config.criticalRatePercent).toBe(19.5);
    expect(config.minIncidentRuns).toBe(3);
    expect(config.evaluatedAtIso).toEqual(expect.any(String));
  });

  it('runs incident alert check with resolved status payload', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue(
      basePreference,
    );
    mailboxSyncService.getMailboxSyncIncidentStatsForUser.mockResolvedValue(
      criticalIncidentStats as any,
    );

    const result = await scheduler.runIncidentAlertCheck({
      userId: 'user-1',
      windowHours: 24,
      warningRatePercent: 10,
      criticalRatePercent: 25,
      minIncidentRuns: 1,
    });

    expect(result.alertsEnabled).toBe(true);
    expect(result.status).toBe('CRITICAL');
    expect(result.shouldAlert).toBe(true);
    expect(result.incidentRuns).toBe(8);
  });

  it('returns disabled check payload when alerts are disabled', async () => {
    process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERTS_ENABLED = 'false';

    const result = await scheduler.runIncidentAlertCheck({
      userId: 'user-1',
    });

    expect(result.alertsEnabled).toBe(false);
    expect(result.statusReason).toBe('alerts-disabled');
    expect(
      mailboxSyncService.getMailboxSyncIncidentStatsForUser,
    ).not.toHaveBeenCalled();
  });
});
