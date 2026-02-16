/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { User } from '../user/entities/user.entity';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AiAgentPlatformHealthAlertScheduler } from './ai-agent-platform-health-alert.scheduler';

describe('AiAgentPlatformHealthAlertScheduler', () => {
  let scheduler: AiAgentPlatformHealthAlertScheduler;
  let userRepo: jest.Mocked<Repository<User>>;
  let notificationRepo: jest.Mocked<Repository<UserNotification>>;
  let aiAgentGatewayService: jest.Mocked<
    Pick<AiAgentGatewayService, 'getPlatformHealthTrendSummary'>
  >;
  let notificationEventBus: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  >;
  const originalAlertsEnabledEnv = process.env.AI_AGENT_HEALTH_ALERTS_ENABLED;
  const originalRecipientsEnv =
    process.env.AI_AGENT_HEALTH_ALERT_RECIPIENT_USER_IDS;
  const originalScanAdminsEnv =
    process.env.AI_AGENT_HEALTH_ALERT_SCAN_ADMIN_USERS;
  const originalCooldownEnv =
    process.env.AI_AGENT_HEALTH_ALERT_COOLDOWN_MINUTES;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    notificationRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotification>>;
    aiAgentGatewayService = {
      getPlatformHealthTrendSummary: jest.fn(),
    };
    notificationEventBus = {
      publishSafely: jest.fn(),
    };

    userRepo.find.mockResolvedValue([
      {
        id: 'admin-1',
      } as User,
    ]);
    notificationRepo.findOne.mockResolvedValue(null);
    notificationRepo.find.mockResolvedValue([]);
    aiAgentGatewayService.getPlatformHealthTrendSummary
      .mockResolvedValueOnce({
        windowHours: 6,
        sampleCount: 8,
        healthyCount: 4,
        warnCount: 2,
        criticalCount: 2,
        avgErrorRatePercent: 12,
        peakErrorRatePercent: 20,
        avgLatencyMs: 1800,
        peakLatencyMs: 2600,
        latestCheckedAtIso: '2026-02-16T05:00:00.000Z',
      })
      .mockResolvedValueOnce({
        windowHours: 72,
        sampleCount: 40,
        healthyCount: 38,
        warnCount: 2,
        criticalCount: 0,
        avgErrorRatePercent: 2,
        peakErrorRatePercent: 5,
        avgLatencyMs: 320,
        peakLatencyMs: 900,
        latestCheckedAtIso: '2026-02-16T05:00:00.000Z',
      });

    scheduler = new AiAgentPlatformHealthAlertScheduler(
      userRepo,
      notificationRepo,
      aiAgentGatewayService as unknown as AiAgentGatewayService,
      notificationEventBus as unknown as NotificationEventBusService,
    );
    delete process.env.AI_AGENT_HEALTH_ALERTS_ENABLED;
    delete process.env.AI_AGENT_HEALTH_ALERT_RECIPIENT_USER_IDS;
    delete process.env.AI_AGENT_HEALTH_ALERT_SCAN_ADMIN_USERS;
    delete process.env.AI_AGENT_HEALTH_ALERT_COOLDOWN_MINUTES;
  });

  afterAll(() => {
    if (typeof originalAlertsEnabledEnv === 'string') {
      process.env.AI_AGENT_HEALTH_ALERTS_ENABLED = originalAlertsEnabledEnv;
    } else {
      delete process.env.AI_AGENT_HEALTH_ALERTS_ENABLED;
    }
    if (typeof originalRecipientsEnv === 'string') {
      process.env.AI_AGENT_HEALTH_ALERT_RECIPIENT_USER_IDS =
        originalRecipientsEnv;
    } else {
      delete process.env.AI_AGENT_HEALTH_ALERT_RECIPIENT_USER_IDS;
    }
    if (typeof originalScanAdminsEnv === 'string') {
      process.env.AI_AGENT_HEALTH_ALERT_SCAN_ADMIN_USERS =
        originalScanAdminsEnv;
    } else {
      delete process.env.AI_AGENT_HEALTH_ALERT_SCAN_ADMIN_USERS;
    }
    if (typeof originalCooldownEnv === 'string') {
      process.env.AI_AGENT_HEALTH_ALERT_COOLDOWN_MINUTES = originalCooldownEnv;
    } else {
      delete process.env.AI_AGENT_HEALTH_ALERT_COOLDOWN_MINUTES;
    }
  });

  it('publishes critical alert notifications for admin recipients', async () => {
    notificationEventBus.publishSafely.mockResolvedValue(null);

    await scheduler.monitorPlatformHealthAlerts();

    expect(
      aiAgentGatewayService.getPlatformHealthTrendSummary,
    ).toHaveBeenCalledTimes(2);
    expect(userRepo.find).toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        type: 'AI_AGENT_PLATFORM_HEALTH_ALERT',
      }),
    );
  });

  it('returns structured result payload from manual health alert check', async () => {
    notificationEventBus.publishSafely.mockResolvedValue(null);

    const result = await scheduler.runHealthAlertCheck({});

    expect(result).toEqual(
      expect.objectContaining({
        alertsEnabled: true,
        severity: 'CRITICAL',
        recipientCount: 1,
        publishedCount: 1,
      }),
    );
  });

  it('skips publishing duplicate warning alerts during cooldown', async () => {
    aiAgentGatewayService.getPlatformHealthTrendSummary
      .mockReset()
      .mockResolvedValueOnce({
        windowHours: 6,
        sampleCount: 8,
        healthyCount: 7,
        warnCount: 1,
        criticalCount: 0,
        avgErrorRatePercent: 7,
        peakErrorRatePercent: 9,
        avgLatencyMs: 900,
        peakLatencyMs: 1200,
        latestCheckedAtIso: '2026-02-16T05:00:00.000Z',
      })
      .mockResolvedValueOnce({
        windowHours: 72,
        sampleCount: 30,
        healthyCount: 30,
        warnCount: 0,
        criticalCount: 0,
        avgErrorRatePercent: 2,
        peakErrorRatePercent: 4,
        avgLatencyMs: 300,
        peakLatencyMs: 500,
        latestCheckedAtIso: '2026-02-16T05:00:00.000Z',
      });
    notificationRepo.findOne.mockResolvedValue({
      createdAt: new Date(),
      metadata: {
        alertSeverity: 'WARNING',
      },
    } as unknown as UserNotification);

    await scheduler.monitorPlatformHealthAlerts();

    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('publishes critical alert during cooldown when severity worsens', async () => {
    notificationRepo.findOne.mockResolvedValue({
      createdAt: new Date(),
      metadata: {
        alertSeverity: 'WARNING',
      },
    } as unknown as UserNotification);
    notificationEventBus.publishSafely.mockResolvedValue(null);

    await scheduler.monitorPlatformHealthAlerts();

    expect(notificationEventBus.publishSafely).toHaveBeenCalledTimes(1);
  });

  it('skips alert evaluation when feature is disabled by env', async () => {
    process.env.AI_AGENT_HEALTH_ALERTS_ENABLED = 'false';

    await scheduler.monitorPlatformHealthAlerts();

    expect(
      aiAgentGatewayService.getPlatformHealthTrendSummary,
    ).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('uses explicit recipient user IDs when admin scanning disabled', async () => {
    process.env.AI_AGENT_HEALTH_ALERT_RECIPIENT_USER_IDS = 'ops-1,ops-2';
    process.env.AI_AGENT_HEALTH_ALERT_SCAN_ADMIN_USERS = 'false';
    notificationEventBus.publishSafely.mockResolvedValue(null);

    await scheduler.monitorPlatformHealthAlerts();

    expect(userRepo.find).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).toHaveBeenCalledTimes(2);
  });

  it('returns alert delivery stats for rolling window', async () => {
    notificationRepo.find.mockResolvedValue([
      {
        userId: 'admin-1',
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
        metadata: { alertSeverity: 'WARNING' },
      },
      {
        userId: 'admin-2',
        createdAt: new Date('2026-02-16T01:00:00.000Z'),
        metadata: { alertSeverity: 'CRITICAL' },
      },
      {
        userId: 'admin-1',
        createdAt: new Date('2026-02-16T02:00:00.000Z'),
        metadata: { alertSeverity: 'CRITICAL' },
      },
    ] as unknown as UserNotification[]);

    const stats = await scheduler.getAlertDeliveryStats({
      windowHours: 24,
    });

    expect(stats).toEqual(
      expect.objectContaining({
        windowHours: 24,
        totalCount: 3,
        warningCount: 1,
        criticalCount: 2,
        uniqueRecipients: 2,
        lastAlertAtIso: '2026-02-16T02:00:00.000Z',
      }),
    );
  });

  it('returns bucketed alert delivery series with recipient counts', async () => {
    const now = Date.now();
    notificationRepo.find.mockResolvedValue([
      {
        userId: 'admin-1',
        createdAt: new Date(now - 25 * 60 * 1000),
        metadata: { alertSeverity: 'WARNING' },
      },
      {
        userId: 'admin-2',
        createdAt: new Date(now - 24 * 60 * 1000),
        metadata: { alertSeverity: 'CRITICAL' },
      },
      {
        userId: 'admin-1',
        createdAt: new Date(now - 8 * 60 * 1000),
        metadata: { alertSeverity: 'WARNING' },
      },
    ] as unknown as UserNotification[]);

    const series = await scheduler.getAlertDeliverySeries({
      windowHours: 1,
      bucketMinutes: 15,
    });

    expect(series.length).toBeGreaterThan(0);
    expect(series.some((point) => point.totalCount > 0)).toBe(true);
    const nonEmptyBucket:
      | {
          totalCount: number;
          uniqueRecipients: number;
        }
      | undefined = series.find((point) => point.totalCount > 0);
    expect(nonEmptyBucket).toBeDefined();
    if (!nonEmptyBucket) {
      throw new Error('Expected at least one non-empty alert delivery bucket');
    }
    expect(nonEmptyBucket.totalCount).toBeGreaterThan(0);
    expect(nonEmptyBucket.uniqueRecipients).toBeGreaterThanOrEqual(1);
  });

  it('exports alert delivery analytics payload with stats and series', async () => {
    const now = Date.now();
    notificationRepo.find
      .mockResolvedValueOnce([
        {
          userId: 'admin-1',
          createdAt: new Date(now - 25 * 60 * 1000),
          metadata: { alertSeverity: 'WARNING' },
        },
      ] as unknown as UserNotification[])
      .mockResolvedValueOnce([
        {
          userId: 'admin-1',
          createdAt: new Date(now - 25 * 60 * 1000),
          metadata: { alertSeverity: 'WARNING' },
        },
      ] as unknown as UserNotification[]);

    const result = await scheduler.exportAlertDeliveryData({
      windowHours: 1,
      bucketMinutes: 15,
    });
    const payload = JSON.parse(result.dataJson) as {
      stats: { totalCount: number };
      series: Array<{ totalCount: number }>;
    };

    expect(payload.stats.totalCount).toBe(1);
    expect(payload.series.length).toBeGreaterThan(0);
    expect(payload.series.some((point) => point.totalCount > 0)).toBe(true);
  });
});
