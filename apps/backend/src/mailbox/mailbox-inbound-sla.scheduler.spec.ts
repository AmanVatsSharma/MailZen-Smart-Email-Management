/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Repository } from 'typeorm';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { UserNotificationPreference } from '../notification/entities/user-notification-preference.entity';
import { NotificationService } from '../notification/notification.service';
import { MailboxInboundEvent } from './entities/mailbox-inbound-event.entity';
import { MailboxInboundSlaScheduler } from './mailbox-inbound-sla.scheduler';
import { MailboxService } from './mailbox.service';

describe('MailboxInboundSlaScheduler', () => {
  let scheduler: MailboxInboundSlaScheduler;
  let inboundEventRepo: jest.Mocked<Repository<MailboxInboundEvent>>;
  let preferenceRepo: jest.Mocked<Repository<UserNotificationPreference>>;
  let mailboxService: jest.Mocked<Pick<MailboxService, 'getInboundEventStats'>>;
  let notificationService: jest.Mocked<
    Pick<
      NotificationService,
      'getOrCreatePreferences' | 'updateMailboxInboundSlaAlertState'
    >
  >;
  let notificationEventBus: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  >;
  let originalInboundSlaAlertsEnabledEnv: string | undefined;

  beforeEach(() => {
    originalInboundSlaAlertsEnabledEnv =
      process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED;
    delete process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED;
    inboundEventRepo = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<MailboxInboundEvent>>;
    preferenceRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotificationPreference>>;
    mailboxService = {
      getInboundEventStats: jest.fn(),
    };
    notificationService = {
      getOrCreatePreferences: jest.fn(),
      updateMailboxInboundSlaAlertState: jest.fn(),
    };
    notificationEventBus = {
      publishSafely: jest.fn(),
    };
    inboundEventRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }]),
    } as any);
    preferenceRepo.find.mockResolvedValue([]);

    scheduler = new MailboxInboundSlaScheduler(
      inboundEventRepo,
      preferenceRepo,
      mailboxService as unknown as MailboxService,
      notificationService as unknown as NotificationService,
      notificationEventBus as unknown as NotificationEventBusService,
    );
  });

  afterEach(() => {
    if (originalInboundSlaAlertsEnabledEnv === undefined) {
      delete process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED;
    } else {
      process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED =
        originalInboundSlaAlertsEnabledEnv;
    }
    jest.clearAllMocks();
  });

  const preferenceSnapshot = {
    id: 'pref-1',
    userId: 'user-1',
    mailboxInboundSlaAlertsEnabled: true,
    mailboxInboundSlaAlertCooldownMinutes: 60,
    mailboxInboundSlaLastAlertStatus: null,
    mailboxInboundSlaLastAlertedAt: null,
  } as UserNotificationPreference;

  const criticalStats = {
    windowHours: 24,
    totalCount: 20,
    acceptedCount: 12,
    deduplicatedCount: 2,
    rejectedCount: 6,
    successRatePercent: 70,
    rejectionRatePercent: 30,
    slaTargetSuccessPercent: 95,
    slaWarningRejectedPercent: 10,
    slaCriticalRejectedPercent: 20,
    slaStatus: 'CRITICAL',
    meetsSla: false,
    lastProcessedAt: new Date('2026-02-16T01:00:00.000Z'),
  };

  it('emits SLA alert notifications for critical status', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue(
      preferenceSnapshot,
    );
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);
    notificationEventBus.publishSafely.mockResolvedValue(null);
    notificationService.updateMailboxInboundSlaAlertState.mockResolvedValue(
      {} as any,
    );

    await scheduler.monitorMailboxInboundSla();

    expect(mailboxService.getInboundEventStats).toHaveBeenCalledWith('user-1', {
      windowHours: 24,
    });
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'MAILBOX_INBOUND_SLA_ALERT',
      }),
    );
    expect(
      notificationService.updateMailboxInboundSlaAlertState,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        status: 'CRITICAL',
      }),
    );
  });

  it('suppresses duplicate alerts during cooldown for unchanged status', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...preferenceSnapshot,
      mailboxInboundSlaLastAlertStatus: 'CRITICAL',
      mailboxInboundSlaLastAlertedAt: new Date(),
    } as UserNotificationPreference);
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);

    await scheduler.monitorMailboxInboundSla();

    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
    expect(
      notificationService.updateMailboxInboundSlaAlertState,
    ).not.toHaveBeenCalled();
  });

  it('uses per-user cooldown minutes when evaluating duplicates', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...preferenceSnapshot,
      mailboxInboundSlaAlertCooldownMinutes: 15,
      mailboxInboundSlaLastAlertStatus: 'CRITICAL',
      mailboxInboundSlaLastAlertedAt: new Date(Date.now() - 20 * 60 * 1000),
    } as UserNotificationPreference);
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);
    notificationEventBus.publishSafely.mockResolvedValue(null);
    notificationService.updateMailboxInboundSlaAlertState.mockResolvedValue(
      {} as any,
    );

    await scheduler.monitorMailboxInboundSla();

    expect(notificationEventBus.publishSafely).toHaveBeenCalledTimes(1);
    expect(
      notificationService.updateMailboxInboundSlaAlertState,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        status: 'CRITICAL',
      }),
    );
  });

  it('emits alert immediately when status worsens even inside cooldown', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...preferenceSnapshot,
      mailboxInboundSlaLastAlertStatus: 'WARNING',
      mailboxInboundSlaLastAlertedAt: new Date(),
    } as UserNotificationPreference);
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);
    notificationEventBus.publishSafely.mockResolvedValue(null);
    notificationService.updateMailboxInboundSlaAlertState.mockResolvedValue(
      {} as any,
    );

    await scheduler.monitorMailboxInboundSla();

    expect(notificationEventBus.publishSafely).toHaveBeenCalledTimes(1);
    expect(
      notificationService.updateMailboxInboundSlaAlertState,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'CRITICAL',
      }),
    );
  });

  it('clears alert state when SLA returns healthy', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...preferenceSnapshot,
      mailboxInboundSlaLastAlertStatus: 'WARNING',
      mailboxInboundSlaLastAlertedAt: new Date('2026-02-16T00:00:00.000Z'),
    } as UserNotificationPreference);
    mailboxService.getInboundEventStats.mockResolvedValue({
      ...criticalStats,
      slaStatus: 'HEALTHY',
      meetsSla: true,
      rejectionRatePercent: 0.5,
      successRatePercent: 99.5,
      rejectedCount: 0,
    } as any);
    notificationService.updateMailboxInboundSlaAlertState.mockResolvedValue(
      {} as any,
    );

    await scheduler.monitorMailboxInboundSla();

    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
    expect(
      notificationService.updateMailboxInboundSlaAlertState,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      status: null,
      alertedAt: null,
    });
  });

  it('skips alerts when SLA alerts are disabled', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...preferenceSnapshot,
      mailboxInboundSlaAlertsEnabled: false,
    } as UserNotificationPreference);
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);

    await scheduler.monitorMailboxInboundSla();

    expect(mailboxService.getInboundEventStats).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('skips monitoring when alerts are disabled by env', async () => {
    process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED = 'false';

    await scheduler.monitorMailboxInboundSla();

    expect(notificationService.getOrCreatePreferences).not.toHaveBeenCalled();
    expect(mailboxService.getInboundEventStats).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('monitors users with stale alert state even without recent events', async () => {
    inboundEventRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    } as any);
    preferenceRepo.find.mockResolvedValue([
      {
        userId: 'user-stale',
      } as UserNotificationPreference,
    ]);
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...preferenceSnapshot,
      userId: 'user-stale',
      mailboxInboundSlaLastAlertStatus: 'WARNING',
      mailboxInboundSlaLastAlertedAt: new Date('2026-02-16T00:00:00.000Z'),
    } as UserNotificationPreference);
    mailboxService.getInboundEventStats.mockResolvedValue({
      ...criticalStats,
      slaStatus: 'HEALTHY',
      meetsSla: true,
      rejectionRatePercent: 0,
      successRatePercent: 100,
      rejectedCount: 0,
    } as any);
    notificationService.updateMailboxInboundSlaAlertState.mockResolvedValue(
      {} as any,
    );

    await scheduler.monitorMailboxInboundSla();

    expect(mailboxService.getInboundEventStats).toHaveBeenCalledWith(
      'user-stale',
      {
        windowHours: 24,
      },
    );
    expect(
      notificationService.updateMailboxInboundSlaAlertState,
    ).toHaveBeenCalledWith({
      userId: 'user-stale',
      status: null,
      alertedAt: null,
    });
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('runs inbound SLA alert check and returns alertable status snapshot', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue(
      preferenceSnapshot,
    );
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);

    const result = await scheduler.runMailboxInboundSlaAlertCheck({
      userId: 'user-1',
      windowHours: 24,
    });

    expect(mailboxService.getInboundEventStats).toHaveBeenCalledWith('user-1', {
      windowHours: 24,
    });
    expect(result).toEqual(
      expect.objectContaining({
        schedulerAlertsEnabled: true,
        alertsEnabled: true,
        windowHours: 24,
        status: 'CRITICAL',
        shouldAlert: true,
        statusReason: 'rejection-rate-critical',
        totalCount: 20,
      }),
    );
  });

  it('marks alert check as non-alertable when alerts are disabled', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...preferenceSnapshot,
      mailboxInboundSlaAlertsEnabled: false,
    } as UserNotificationPreference);
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);

    const result = await scheduler.runMailboxInboundSlaAlertCheck({
      userId: 'user-1',
      windowHours: 24,
    });

    expect(result.shouldAlert).toBe(false);
    expect(result.schedulerAlertsEnabled).toBe(true);
    expect(result.alertsEnabled).toBe(false);
    expect(result.statusReason).toBe('alerts-disabled');
  });

  it('returns env-disabled status reason for alert check when scheduler is disabled', async () => {
    process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED = 'false';
    notificationService.getOrCreatePreferences.mockResolvedValue(
      preferenceSnapshot,
    );
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);

    const result = await scheduler.runMailboxInboundSlaAlertCheck({
      userId: 'user-1',
      windowHours: 24,
    });

    expect(result.schedulerAlertsEnabled).toBe(false);
    expect(result.shouldAlert).toBe(false);
    expect(result.statusReason).toBe('alerts-disabled-by-env');
  });
});
