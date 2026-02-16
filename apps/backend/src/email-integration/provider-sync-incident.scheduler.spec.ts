/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { NotificationService } from '../notification/notification.service';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { UserNotificationPreference } from '../notification/entities/user-notification-preference.entity';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderService } from './email-provider.service';
import { ProviderSyncIncidentScheduler } from './provider-sync-incident.scheduler';

describe('ProviderSyncIncidentScheduler', () => {
  let scheduler: ProviderSyncIncidentScheduler;
  let providerRepository: jest.Mocked<Repository<EmailProvider>>;
  let notificationRepository: jest.Mocked<Repository<UserNotification>>;
  let emailProviderService: jest.Mocked<
    Pick<EmailProviderService, 'getProviderSyncStatsForUser'>
  >;
  let notificationService: jest.Mocked<
    Pick<NotificationService, 'getOrCreatePreferences'>
  >;
  let notificationEventBus: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  >;
  let originalIncidentAlertsEnabledEnv: string | undefined;

  beforeEach(() => {
    originalIncidentAlertsEnabledEnv =
      process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERTS_ENABLED;
    delete process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERTS_ENABLED;
    providerRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    notificationRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotification>>;
    emailProviderService = {
      getProviderSyncStatsForUser: jest.fn(),
    };
    notificationService = {
      getOrCreatePreferences: jest.fn(),
    };
    notificationEventBus = {
      publishSafely: jest.fn(),
    };
    providerRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }]),
    } as any);
    notificationRepository.findOne.mockResolvedValue(null);
    notificationService.getOrCreatePreferences.mockResolvedValue({
      userId: 'user-1',
      syncFailureEnabled: true,
    } as UserNotificationPreference);

    scheduler = new ProviderSyncIncidentScheduler(
      providerRepository,
      notificationRepository,
      emailProviderService as unknown as EmailProviderService,
      notificationService as unknown as NotificationService,
      notificationEventBus as unknown as NotificationEventBusService,
    );
  });

  afterEach(() => {
    if (originalIncidentAlertsEnabledEnv === undefined) {
      delete process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERTS_ENABLED;
    } else {
      process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERTS_ENABLED =
        originalIncidentAlertsEnabledEnv;
    }
    jest.clearAllMocks();
  });

  const warningStats = {
    totalProviders: 3,
    connectedProviders: 1,
    syncingProviders: 1,
    errorProviders: 1,
    recentlySyncedProviders: 2,
    recentlyErroredProviders: 1,
    windowHours: 24,
    executedAtIso: '2026-02-16T00:00:00.000Z',
  };

  it('emits provider sync incident alert when warning threshold is exceeded', async () => {
    emailProviderService.getProviderSyncStatsForUser.mockResolvedValue(
      warningStats,
    );

    await scheduler.monitorProviderSyncIncidents();

    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'PROVIDER_SYNC_INCIDENT_ALERT',
      }),
    );
  });

  it('suppresses duplicate incident alerts during cooldown', async () => {
    emailProviderService.getProviderSyncStatsForUser.mockResolvedValue(
      warningStats,
    );
    notificationRepository.findOne.mockResolvedValue({
      id: 'notif-1',
      type: 'PROVIDER_SYNC_INCIDENT_ALERT',
      metadata: { status: 'WARNING' },
      createdAt: new Date(),
    } as unknown as UserNotification);

    await scheduler.monitorProviderSyncIncidents();

    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('skips monitoring when env toggle disables alerts', async () => {
    process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERTS_ENABLED = 'false';

    await scheduler.monitorProviderSyncIncidents();

    expect(providerRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('returns provider sync incident alert config snapshot', () => {
    const config = scheduler.getIncidentAlertConfigSnapshot();

    expect(config).toEqual(
      expect.objectContaining({
        alertsEnabled: true,
        windowHours: 24,
        cooldownMinutes: 60,
      }),
    );
  });

  it('runs incident alert check for current provider sync stats', async () => {
    emailProviderService.getProviderSyncStatsForUser.mockResolvedValue(
      warningStats,
    );

    const result = await scheduler.runIncidentAlertCheck({
      userId: 'user-1',
      windowHours: 24,
      warningErrorProviderPercent: 20,
      criticalErrorProviderPercent: 50,
      minErrorProviders: 1,
    });

    expect(result.syncFailureEnabled).toBe(true);
    expect(result.status).toBe('WARNING');
    expect(result.shouldAlert).toBe(true);
    expect(result.errorProviderPercent).toBeCloseTo(33.33, 2);
  });

  it('returns non-alertable incident check when sync failure preference is disabled', async () => {
    notificationService.getOrCreatePreferences.mockResolvedValue({
      userId: 'user-1',
      syncFailureEnabled: false,
    } as UserNotificationPreference);
    emailProviderService.getProviderSyncStatsForUser.mockResolvedValue(
      warningStats,
    );

    const result = await scheduler.runIncidentAlertCheck({
      userId: 'user-1',
      windowHours: 24,
      warningErrorProviderPercent: 20,
      criticalErrorProviderPercent: 50,
      minErrorProviders: 1,
    });

    expect(result.syncFailureEnabled).toBe(false);
    expect(result.status).toBe('WARNING');
    expect(result.shouldAlert).toBe(false);
    expect(result.statusReason).toBe(
      'sync-failure-alerts-disabled-by-preference',
    );
  });

  it('returns disabled status reason when incident alerts are disabled by env', async () => {
    process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERTS_ENABLED = 'false';

    const result = await scheduler.runIncidentAlertCheck({
      userId: 'user-1',
    });

    expect(result.alertsEnabled).toBe(false);
    expect(result.syncFailureEnabled).toBe(true);
    expect(result.statusReason).toBe('alerts-disabled-by-env');
    expect(result.shouldAlert).toBe(false);
  });
});
