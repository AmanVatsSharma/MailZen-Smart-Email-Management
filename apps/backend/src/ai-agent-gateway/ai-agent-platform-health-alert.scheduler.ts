import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { User } from '../user/entities/user.entity';
import { AiAgentGatewayService } from './ai-agent-gateway.service';

type AlertSeverity = 'WARNING' | 'CRITICAL';

@Injectable()
export class AiAgentPlatformHealthAlertScheduler {
  private static readonly DEFAULT_WINDOW_HOURS = 6;
  private static readonly DEFAULT_BASELINE_WINDOW_HOURS = 72;
  private static readonly DEFAULT_COOLDOWN_MINUTES = 60;
  private static readonly DEFAULT_MIN_SAMPLE_COUNT = 4;
  private static readonly DEFAULT_MAX_RECIPIENTS = 25;
  private static readonly DEFAULT_ANOMALY_MULTIPLIER = 2;
  private static readonly DEFAULT_ANOMALY_MIN_ERROR_RATE_DELTA_PERCENT = 1;
  private static readonly DEFAULT_ANOMALY_MIN_LATENCY_DELTA_MS = 150;
  private static readonly DEFAULT_ALERT_ERROR_RATE_PERCENT = 5;
  private static readonly DEFAULT_ALERT_LATENCY_MS = 1500;
  private readonly logger = new Logger(
    AiAgentPlatformHealthAlertScheduler.name,
  );

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
    private readonly aiAgentGatewayService: AiAgentGatewayService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  @Cron('*/15 * * * *')
  async monitorPlatformHealthAlerts(): Promise<void> {
    if (!this.isAlertsEnabled()) {
      this.logger.log('agent-platform-alerts: disabled by env');
      return;
    }

    const windowHours = this.resolvePositiveInteger({
      rawValue: process.env.AI_AGENT_HEALTH_ALERT_WINDOW_HOURS,
      fallbackValue: AiAgentPlatformHealthAlertScheduler.DEFAULT_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: 24 * 14,
    });
    const baselineWindowHours = this.resolvePositiveInteger({
      rawValue: process.env.AI_AGENT_HEALTH_ALERT_BASELINE_WINDOW_HOURS,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_BASELINE_WINDOW_HOURS,
      minimumValue: windowHours,
      maximumValue: 24 * 90,
    });
    const cooldownMinutes = this.resolvePositiveInteger({
      rawValue: process.env.AI_AGENT_HEALTH_ALERT_COOLDOWN_MINUTES,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_COOLDOWN_MINUTES,
      minimumValue: 1,
      maximumValue: 24 * 7 * 60,
    });
    const minSampleCount = this.resolvePositiveInteger({
      rawValue: process.env.AI_AGENT_HEALTH_ALERT_MIN_SAMPLE_COUNT,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_MIN_SAMPLE_COUNT,
      minimumValue: 1,
      maximumValue: 1000,
    });
    const anomalyMultiplier = this.resolvePositiveFloat({
      rawValue: process.env.AI_AGENT_HEALTH_ALERT_ANOMALY_MULTIPLIER,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MULTIPLIER,
      minimumValue: 1.1,
      maximumValue: 10,
    });
    const anomalyMinErrorDeltaPercent = this.resolvePositiveFloat({
      rawValue:
        process.env.AI_AGENT_HEALTH_ALERT_ANOMALY_MIN_ERROR_RATE_DELTA_PERCENT,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MIN_ERROR_RATE_DELTA_PERCENT,
      minimumValue: 0,
      maximumValue: 100,
    });
    const anomalyMinLatencyDeltaMs = this.resolvePositiveFloat({
      rawValue: process.env.AI_AGENT_HEALTH_ALERT_ANOMALY_MIN_LATENCY_DELTA_MS,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MIN_LATENCY_DELTA_MS,
      minimumValue: 0,
      maximumValue: 60_000,
    });

    const [currentSummary, baselineSummary] = await Promise.all([
      this.aiAgentGatewayService.getPlatformHealthTrendSummary({
        windowHours,
      }),
      this.aiAgentGatewayService.getPlatformHealthTrendSummary({
        windowHours: baselineWindowHours,
      }),
    ]);

    if (currentSummary.sampleCount < minSampleCount) {
      this.logger.log(
        `agent-platform-alerts: skipped due to insufficient samples sampleCount=${currentSummary.sampleCount} min=${minSampleCount}`,
      );
      return;
    }

    const alertAssessment = this.assessAlertState({
      currentSummary,
      baselineSummary,
      anomalyMultiplier,
      anomalyMinErrorDeltaPercent,
      anomalyMinLatencyDeltaMs,
      minSampleCount,
    });
    if (!alertAssessment.severity) {
      this.logger.log(
        `agent-platform-alerts: no alert currentState healthy sampleCount=${currentSummary.sampleCount}`,
      );
      return;
    }

    const recipientUserIds = await this.resolveRecipientUserIds();
    if (!recipientUserIds.length) {
      this.logger.warn(
        `agent-platform-alerts: no recipients configured severity=${alertAssessment.severity}`,
      );
      return;
    }

    const fingerprint = [
      alertAssessment.severity,
      currentSummary.latestCheckedAtIso || 'none',
      `${currentSummary.avgErrorRatePercent}:${currentSummary.avgLatencyMs}`,
      alertAssessment.reasons.join('|'),
    ].join('#');
    let publishedCount = 0;

    for (const userId of recipientUserIds) {
      const shouldPublish = await this.shouldPublishAlert({
        userId,
        fingerprint,
        severity: alertAssessment.severity,
        cooldownMinutes,
      });
      if (!shouldPublish) continue;

      await this.notificationEventBus.publishSafely({
        userId,
        type: 'AI_AGENT_PLATFORM_HEALTH_ALERT',
        title:
          alertAssessment.severity === 'CRITICAL'
            ? 'AI platform health critical'
            : 'AI platform health warning',
        message:
          alertAssessment.severity === 'CRITICAL'
            ? `AI platform is critical: error avg ${currentSummary.avgErrorRatePercent.toFixed(2)}% / latency avg ${currentSummary.avgLatencyMs.toFixed(0)}ms (window ${windowHours}h).`
            : `AI platform warning: error avg ${currentSummary.avgErrorRatePercent.toFixed(2)}% / latency avg ${currentSummary.avgLatencyMs.toFixed(0)}ms (window ${windowHours}h).`,
        metadata: {
          source: 'ai-agent-platform-health-alert-scheduler',
          alertSeverity: alertAssessment.severity,
          alertReasons: alertAssessment.reasons,
          alertFingerprint: fingerprint,
          windowHours,
          baselineWindowHours,
          cooldownMinutes,
          anomalyMultiplier,
          anomalyMinErrorDeltaPercent,
          anomalyMinLatencyDeltaMs,
          currentSummary,
          baselineSummary,
        },
      });
      publishedCount += 1;
    }

    this.logger.warn(
      `agent-platform-alerts: evaluated severity=${alertAssessment.severity} recipients=${recipientUserIds.length} published=${publishedCount}`,
    );
  }

  private isAlertsEnabled(): boolean {
    const normalized = String(
      process.env.AI_AGENT_HEALTH_ALERTS_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  private assessAlertState(input: {
    currentSummary: {
      sampleCount: number;
      warnCount: number;
      criticalCount: number;
      avgErrorRatePercent: number;
      avgLatencyMs: number;
      peakErrorRatePercent: number;
      peakLatencyMs: number;
    };
    baselineSummary: {
      sampleCount: number;
      avgErrorRatePercent: number;
      avgLatencyMs: number;
    };
    anomalyMultiplier: number;
    anomalyMinErrorDeltaPercent: number;
    anomalyMinLatencyDeltaMs: number;
    minSampleCount: number;
  }): {
    severity: AlertSeverity | null;
    reasons: string[];
  } {
    const alertErrorRatePercent = this.resolvePositiveFloat({
      rawValue: process.env.AI_AGENT_ALERT_ERROR_RATE_PERCENT,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ALERT_ERROR_RATE_PERCENT,
      minimumValue: 0,
      maximumValue: 100,
    });
    const alertLatencyMs = this.resolvePositiveFloat({
      rawValue: process.env.AI_AGENT_ALERT_LATENCY_MS,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ALERT_LATENCY_MS,
      minimumValue: 1,
      maximumValue: 60_000,
    });

    const reasons: string[] = [];
    if (input.currentSummary.criticalCount > 0) {
      reasons.push('critical-samples-detected');
    }
    if (input.currentSummary.warnCount > 0) {
      reasons.push('warn-samples-detected');
    }
    if (input.currentSummary.avgErrorRatePercent >= alertErrorRatePercent) {
      reasons.push('avg-error-rate-threshold-exceeded');
    }
    if (input.currentSummary.avgLatencyMs >= alertLatencyMs) {
      reasons.push('avg-latency-threshold-exceeded');
    }

    const hasBaseline =
      input.baselineSummary.sampleCount >= input.minSampleCount;
    const baselineErrorRate = hasBaseline
      ? input.baselineSummary.avgErrorRatePercent
      : 0;
    const baselineLatency = hasBaseline
      ? input.baselineSummary.avgLatencyMs
      : 0;
    const errorRateAnomaly =
      hasBaseline &&
      input.currentSummary.avgErrorRatePercent >=
        baselineErrorRate * input.anomalyMultiplier &&
      input.currentSummary.avgErrorRatePercent - baselineErrorRate >=
        input.anomalyMinErrorDeltaPercent;
    const latencyAnomaly =
      hasBaseline &&
      input.currentSummary.avgLatencyMs >=
        baselineLatency * input.anomalyMultiplier &&
      input.currentSummary.avgLatencyMs - baselineLatency >=
        input.anomalyMinLatencyDeltaMs;

    if (errorRateAnomaly) reasons.push('error-rate-anomaly');
    if (latencyAnomaly) reasons.push('latency-anomaly');

    let severity: AlertSeverity | null = null;
    if (
      input.currentSummary.criticalCount > 0 ||
      input.currentSummary.peakErrorRatePercent >= alertErrorRatePercent * 2 ||
      input.currentSummary.peakLatencyMs >= alertLatencyMs * 2
    ) {
      severity = 'CRITICAL';
    } else if (
      reasons.length > 0 ||
      input.currentSummary.warnCount > 0 ||
      errorRateAnomaly ||
      latencyAnomaly
    ) {
      severity = 'WARNING';
    }
    return {
      severity,
      reasons: reasons.length > 0 ? reasons : ['state-transition-detected'],
    };
  }

  private async resolveRecipientUserIds(): Promise<string[]> {
    const configuredUserIds = this.normalizeCsv(
      process.env.AI_AGENT_HEALTH_ALERT_RECIPIENT_USER_IDS,
    );
    const includeAdminRoleScan = !['false', '0', 'off', 'no'].includes(
      String(process.env.AI_AGENT_HEALTH_ALERT_SCAN_ADMIN_USERS || 'true')
        .trim()
        .toLowerCase(),
    );
    if (!includeAdminRoleScan) {
      return configuredUserIds;
    }

    const adminUsers = await this.userRepo.find({
      select: ['id'],
      where: {
        role: 'ADMIN',
      },
      order: {
        createdAt: 'ASC',
      },
      take: AiAgentPlatformHealthAlertScheduler.DEFAULT_MAX_RECIPIENTS,
    });
    const scannedAdminUserIds = adminUsers
      .map((user) => String(user.id || '').trim())
      .filter((value) => value.length > 0);
    return Array.from(new Set([...configuredUserIds, ...scannedAdminUserIds]));
  }

  private async shouldPublishAlert(input: {
    userId: string;
    fingerprint: string;
    severity: AlertSeverity;
    cooldownMinutes: number;
  }): Promise<boolean> {
    const lastNotification = await this.notificationRepo.findOne({
      where: {
        userId: input.userId,
        type: 'AI_AGENT_PLATFORM_HEALTH_ALERT',
      },
      order: {
        createdAt: 'DESC',
      },
    });
    if (!lastNotification) return true;
    const lastFingerprint = this.readMetadataString(
      lastNotification.metadata,
      'alertFingerprint',
    );
    if (lastFingerprint && lastFingerprint === input.fingerprint) {
      return false;
    }
    const lastSeverity = this.normalizeSeverity(
      lastNotification.metadata?.alertSeverity,
    );
    if (lastSeverity === 'WARNING' && input.severity === 'CRITICAL') {
      return true;
    }
    const elapsedMs = Date.now() - lastNotification.createdAt.getTime();
    return elapsedMs >= input.cooldownMinutes * 60 * 1000;
  }

  private normalizeSeverity(value: unknown): AlertSeverity | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    if (normalized === 'CRITICAL') return 'CRITICAL';
    if (normalized === 'WARNING') return 'WARNING';
    return null;
  }

  private readMetadataString(
    metadata: Record<string, unknown> | undefined,
    key: string,
  ): string {
    const rawValue = metadata?.[key];
    if (typeof rawValue === 'string') return rawValue.trim();
    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      return String(rawValue);
    }
    return '';
  }

  private normalizeCsv(rawValue?: string): string[] {
    return String(rawValue || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private resolvePositiveInteger(input: {
    rawValue?: string;
    fallbackValue: number;
    minimumValue: number;
    maximumValue: number;
  }): number {
    const parsedValue = Number(input.rawValue);
    const candidate = Number.isFinite(parsedValue)
      ? Math.floor(parsedValue)
      : input.fallbackValue;
    if (candidate < input.minimumValue) return input.minimumValue;
    if (candidate > input.maximumValue) return input.maximumValue;
    return candidate;
  }

  private resolvePositiveFloat(input: {
    rawValue?: string;
    fallbackValue: number;
    minimumValue: number;
    maximumValue: number;
  }): number {
    const parsedValue = Number(input.rawValue);
    const candidate = Number.isFinite(parsedValue)
      ? parsedValue
      : input.fallbackValue;
    if (candidate < input.minimumValue) return input.minimumValue;
    if (candidate > input.maximumValue) return input.maximumValue;
    return Math.round(candidate * 100) / 100;
  }
}
