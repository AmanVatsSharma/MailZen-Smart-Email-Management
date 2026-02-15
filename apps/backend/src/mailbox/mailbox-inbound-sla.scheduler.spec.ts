/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Repository } from 'typeorm';
import { UserNotificationPreference } from '../notification/entities/user-notification-preference.entity';
import { NotificationService } from '../notification/notification.service';
import { MailboxInboundEvent } from './entities/mailbox-inbound-event.entity';
import { MailboxInboundSlaScheduler } from './mailbox-inbound-sla.scheduler';
import { MailboxService } from './mailbox.service';

describe('MailboxInboundSlaScheduler', () => {
  let scheduler: MailboxInboundSlaScheduler;
  let inboundEventRepo: jest.Mocked<Repository<MailboxInboundEvent>>;
  let mailboxService: jest.Mocked<Pick<MailboxService, 'getInboundEventStats'>>;
  let notificationService: jest.Mocked<
    Pick<
      NotificationService,
      | 'getOrCreatePreferences'
      | 'createNotification'
      | 'updateMailboxInboundSlaAlertState'
    >
  >;

  beforeEach(() => {
    inboundEventRepo = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<MailboxInboundEvent>>;
    mailboxService = {
      getInboundEventStats: jest.fn(),
    };
    notificationService = {
      getOrCreatePreferences: jest.fn(),
      createNotification: jest.fn(),
      updateMailboxInboundSlaAlertState: jest.fn(),
    };
    inboundEventRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }]),
    } as any);

    scheduler = new MailboxInboundSlaScheduler(
      inboundEventRepo,
      mailboxService as unknown as MailboxService,
      notificationService as unknown as NotificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const preferenceSnapshot = {
    id: 'pref-1',
    userId: 'user-1',
    mailboxInboundSlaAlertsEnabled: true,
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
    notificationService.createNotification.mockResolvedValue({} as any);
    notificationService.updateMailboxInboundSlaAlertState.mockResolvedValue(
      {} as any,
    );

    await scheduler.monitorMailboxInboundSla();

    expect(mailboxService.getInboundEventStats).toHaveBeenCalledWith('user-1', {
      windowHours: 24,
    });
    expect(notificationService.createNotification).toHaveBeenCalledWith(
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

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(
      notificationService.updateMailboxInboundSlaAlertState,
    ).not.toHaveBeenCalled();
  });

  it('emits alert immediately when status worsens even inside cooldown', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      ...preferenceSnapshot,
      mailboxInboundSlaLastAlertStatus: 'WARNING',
      mailboxInboundSlaLastAlertedAt: new Date(),
    } as UserNotificationPreference);
    mailboxService.getInboundEventStats.mockResolvedValue(criticalStats as any);
    notificationService.createNotification.mockResolvedValue({} as any);
    notificationService.updateMailboxInboundSlaAlertState.mockResolvedValue(
      {} as any,
    );

    await scheduler.monitorMailboxInboundSla();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
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

    expect(notificationService.createNotification).not.toHaveBeenCalled();
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
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});
