import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { User } from '../user/entities/user.entity';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AgentPlatformHealthAlertRun } from './entities/agent-platform-health-alert-run.entity';

type AlertSeverity = 'WARNING' | 'CRITICAL';
export type AgentPlatformHealthAlertCheckResult = {
  alertsEnabled: boolean;
  evaluatedAtIso: string;
  windowHours: number;
  baselineWindowHours: number;
  cooldownMinutes: number;
  minSampleCount: number;
  severity?: AlertSeverity | null;
  reasons: string[];
  recipientCount: number;
  publishedCount: number;
};

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
  private static readonly DEFAULT_ALERT_DELIVERY_WINDOW_HOURS = 24;
  private static readonly MAX_ALERT_DELIVERY_SAMPLE_SCAN = 10_000;
  private static readonly DEFAULT_ALERT_DELIVERY_BUCKET_MINUTES = 60;
  private static readonly MIN_ALERT_DELIVERY_BUCKET_MINUTES = 5;
  private static readonly MAX_ALERT_DELIVERY_BUCKET_MINUTES = 24 * 60;
  private static readonly DEFAULT_ALERT_RUN_HISTORY_LIMIT = 100;
  private static readonly MAX_ALERT_RUN_HISTORY_LIMIT = 2000;
  private static readonly DEFAULT_ALERT_RUN_RETENTION_DAYS = 120;
  private readonly logger = new Logger(
    AiAgentPlatformHealthAlertScheduler.name,
  );

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
    @InjectRepository(AgentPlatformHealthAlertRun)
    private readonly alertRunRepo: Repository<AgentPlatformHealthAlertRun>,
    private readonly aiAgentGatewayService: AiAgentGatewayService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  @Cron('*/15 * * * *')
  async monitorPlatformHealthAlerts(): Promise<void> {
    await this.runHealthAlertCheck({});
  }

  getAlertConfigSnapshot(): {
    alertsEnabled: boolean;
    scanAdminUsers: boolean;
    configuredRecipientUserIds: string[];
    windowHours: number;
    baselineWindowHours: number;
    cooldownMinutes: number;
    minSampleCount: number;
    anomalyMultiplier: number;
    anomalyMinErrorDeltaPercent: number;
    anomalyMinLatencyDeltaMs: number;
    errorRateWarnPercent: number;
    latencyWarnMs: number;
    maxDeliverySampleScan: number;
    evaluatedAtIso: string;
  } {
    const windowHours = this.resolvePositiveInteger({
      rawValue: process.env.AI_AGENT_HEALTH_ALERT_WINDOW_HOURS,
      fallbackValue: AiAgentPlatformHealthAlertScheduler.DEFAULT_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: 24 * 14,
    });
    return {
      alertsEnabled: this.isAlertsEnabled(),
      scanAdminUsers: this.isAdminRoleScanEnabled(),
      configuredRecipientUserIds: this.normalizeCsv(
        process.env.AI_AGENT_HEALTH_ALERT_RECIPIENT_USER_IDS,
      ),
      windowHours,
      baselineWindowHours: this.resolvePositiveInteger({
        rawValue: process.env.AI_AGENT_HEALTH_ALERT_BASELINE_WINDOW_HOURS,
        fallbackValue:
          AiAgentPlatformHealthAlertScheduler.DEFAULT_BASELINE_WINDOW_HOURS,
        minimumValue: windowHours,
        maximumValue: 24 * 90,
      }),
      cooldownMinutes: this.resolvePositiveInteger({
        rawValue: process.env.AI_AGENT_HEALTH_ALERT_COOLDOWN_MINUTES,
        fallbackValue:
          AiAgentPlatformHealthAlertScheduler.DEFAULT_COOLDOWN_MINUTES,
        minimumValue: 1,
        maximumValue: 24 * 7 * 60,
      }),
      minSampleCount: this.resolvePositiveInteger({
        rawValue: process.env.AI_AGENT_HEALTH_ALERT_MIN_SAMPLE_COUNT,
        fallbackValue:
          AiAgentPlatformHealthAlertScheduler.DEFAULT_MIN_SAMPLE_COUNT,
        minimumValue: 1,
        maximumValue: 1000,
      }),
      anomalyMultiplier: this.resolvePositiveFloat({
        rawValue: process.env.AI_AGENT_HEALTH_ALERT_ANOMALY_MULTIPLIER,
        fallbackValue:
          AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MULTIPLIER,
        minimumValue: 1.1,
        maximumValue: 10,
      }),
      anomalyMinErrorDeltaPercent: this.resolvePositiveFloat({
        rawValue:
          process.env
            .AI_AGENT_HEALTH_ALERT_ANOMALY_MIN_ERROR_RATE_DELTA_PERCENT,
        fallbackValue:
          AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MIN_ERROR_RATE_DELTA_PERCENT,
        minimumValue: 0,
        maximumValue: 100,
      }),
      anomalyMinLatencyDeltaMs: this.resolvePositiveFloat({
        rawValue:
          process.env.AI_AGENT_HEALTH_ALERT_ANOMALY_MIN_LATENCY_DELTA_MS,
        fallbackValue:
          AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MIN_LATENCY_DELTA_MS,
        minimumValue: 0,
        maximumValue: 60_000,
      }),
      errorRateWarnPercent: this.resolveAlertErrorRateWarnPercent(),
      latencyWarnMs: this.resolveAlertLatencyWarnMs(),
      maxDeliverySampleScan:
        AiAgentPlatformHealthAlertScheduler.MAX_ALERT_DELIVERY_SAMPLE_SCAN,
      evaluatedAtIso: new Date().toISOString(),
    };
  }

  async runHealthAlertCheck(input: {
    windowHours?: number | null;
    baselineWindowHours?: number | null;
    cooldownMinutes?: number | null;
    minSampleCount?: number | null;
    anomalyMultiplier?: number | null;
    anomalyMinErrorDeltaPercent?: number | null;
    anomalyMinLatencyDeltaMs?: number | null;
  }): Promise<AgentPlatformHealthAlertCheckResult> {
    const evaluatedAtIso = new Date().toISOString();
    const alertsEnabled = this.isAlertsEnabled();
    const windowHours = this.resolvePositiveInteger({
      rawValue:
        input.windowHours ?? process.env.AI_AGENT_HEALTH_ALERT_WINDOW_HOURS,
      fallbackValue: AiAgentPlatformHealthAlertScheduler.DEFAULT_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: 24 * 14,
    });
    const baselineWindowHours = this.resolvePositiveInteger({
      rawValue:
        input.baselineWindowHours ??
        process.env.AI_AGENT_HEALTH_ALERT_BASELINE_WINDOW_HOURS,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_BASELINE_WINDOW_HOURS,
      minimumValue: windowHours,
      maximumValue: 24 * 90,
    });
    const cooldownMinutes = this.resolvePositiveInteger({
      rawValue:
        input.cooldownMinutes ??
        process.env.AI_AGENT_HEALTH_ALERT_COOLDOWN_MINUTES,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_COOLDOWN_MINUTES,
      minimumValue: 1,
      maximumValue: 24 * 7 * 60,
    });
    const minSampleCount = this.resolvePositiveInteger({
      rawValue:
        input.minSampleCount ??
        process.env.AI_AGENT_HEALTH_ALERT_MIN_SAMPLE_COUNT,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_MIN_SAMPLE_COUNT,
      minimumValue: 1,
      maximumValue: 1000,
    });
    const anomalyMultiplier = this.resolvePositiveFloat({
      rawValue:
        input.anomalyMultiplier ??
        process.env.AI_AGENT_HEALTH_ALERT_ANOMALY_MULTIPLIER,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MULTIPLIER,
      minimumValue: 1.1,
      maximumValue: 10,
    });
    const anomalyMinErrorDeltaPercent = this.resolvePositiveFloat({
      rawValue:
        input.anomalyMinErrorDeltaPercent ??
        process.env.AI_AGENT_HEALTH_ALERT_ANOMALY_MIN_ERROR_RATE_DELTA_PERCENT,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MIN_ERROR_RATE_DELTA_PERCENT,
      minimumValue: 0,
      maximumValue: 100,
    });
    const anomalyMinLatencyDeltaMs = this.resolvePositiveFloat({
      rawValue:
        input.anomalyMinLatencyDeltaMs ??
        process.env.AI_AGENT_HEALTH_ALERT_ANOMALY_MIN_LATENCY_DELTA_MS,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ANOMALY_MIN_LATENCY_DELTA_MS,
      minimumValue: 0,
      maximumValue: 60_000,
    });
    const errorRateWarnPercent = this.resolveAlertErrorRateWarnPercent();
    const latencyWarnMs = this.resolveAlertLatencyWarnMs();
    const finalizeResult = async (
      result: AgentPlatformHealthAlertCheckResult,
    ): Promise<AgentPlatformHealthAlertCheckResult> => {
      await this.persistAlertRun(result, {
        anomalyMultiplier,
        anomalyMinErrorDeltaPercent,
        anomalyMinLatencyDeltaMs,
        errorRateWarnPercent,
        latencyWarnMs,
      });
      return result;
    };

    if (!alertsEnabled) {
      this.logger.log('agent-platform-alerts: disabled by env');
      return finalizeResult({
        alertsEnabled: false,
        evaluatedAtIso,
        windowHours,
        baselineWindowHours,
        cooldownMinutes,
        minSampleCount,
        severity: null,
        reasons: ['alerts-disabled'],
        recipientCount: 0,
        publishedCount: 0,
      });
    }

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
      return finalizeResult({
        alertsEnabled: true,
        evaluatedAtIso,
        windowHours,
        baselineWindowHours,
        cooldownMinutes,
        minSampleCount,
        severity: null,
        reasons: ['insufficient-samples'],
        recipientCount: 0,
        publishedCount: 0,
      });
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
      return finalizeResult({
        alertsEnabled: true,
        evaluatedAtIso,
        windowHours,
        baselineWindowHours,
        cooldownMinutes,
        minSampleCount,
        severity: null,
        reasons: alertAssessment.reasons,
        recipientCount: 0,
        publishedCount: 0,
      });
    }

    const recipientUserIds = await this.resolveRecipientUserIds();
    if (!recipientUserIds.length) {
      this.logger.warn(
        `agent-platform-alerts: no recipients configured severity=${alertAssessment.severity}`,
      );
      return finalizeResult({
        alertsEnabled: true,
        evaluatedAtIso,
        windowHours,
        baselineWindowHours,
        cooldownMinutes,
        minSampleCount,
        severity: alertAssessment.severity,
        reasons: alertAssessment.reasons,
        recipientCount: 0,
        publishedCount: 0,
      });
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
    return finalizeResult({
      alertsEnabled: true,
      evaluatedAtIso,
      windowHours,
      baselineWindowHours,
      cooldownMinutes,
      minSampleCount,
      severity: alertAssessment.severity,
      reasons: alertAssessment.reasons,
      recipientCount: recipientUserIds.length,
      publishedCount,
    });
  }

  async getAlertRunHistory(input?: {
    limit?: number | null;
    windowHours?: number | null;
  }): Promise<
    Array<{
      alertsEnabled: boolean;
      severity?: string | null;
      reasons: string[];
      windowHours: number;
      baselineWindowHours: number;
      cooldownMinutes: number;
      minSampleCount: number;
      anomalyMultiplier: number;
      anomalyMinErrorDeltaPercent: number;
      anomalyMinLatencyDeltaMs: number;
      errorRateWarnPercent: number;
      latencyWarnMs: number;
      recipientCount: number;
      publishedCount: number;
      evaluatedAtIso: string;
    }>
  > {
    const limit = this.normalizeAlertRunHistoryLimit(input?.limit);
    const windowHours = this.normalizeAlertDeliveryWindowHours(
      input?.windowHours,
    );
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const rows = await this.alertRunRepo.find({
      where: {
        evaluatedAt: MoreThanOrEqual(windowStartDate),
      },
      order: {
        evaluatedAt: 'DESC',
      },
      take: limit,
    });
    return rows.map((row) => ({
      alertsEnabled: row.alertsEnabled,
      severity: row.severity || null,
      reasons: this.normalizeAlertRunReasons(row.reasons),
      windowHours: row.windowHours,
      baselineWindowHours: row.baselineWindowHours,
      cooldownMinutes: row.cooldownMinutes,
      minSampleCount: row.minSampleCount,
      anomalyMultiplier: row.anomalyMultiplier,
      anomalyMinErrorDeltaPercent: row.anomalyMinErrorDeltaPercent,
      anomalyMinLatencyDeltaMs: row.anomalyMinLatencyDeltaMs,
      errorRateWarnPercent: row.errorRateWarnPercent,
      latencyWarnMs: row.latencyWarnMs,
      recipientCount: row.recipientCount,
      publishedCount: row.publishedCount,
      evaluatedAtIso: row.evaluatedAt.toISOString(),
    }));
  }

  async exportAlertRunHistoryData(input?: {
    limit?: number | null;
    windowHours?: number | null;
  }): Promise<{
    generatedAtIso: string;
    dataJson: string;
  }> {
    const limit = this.normalizeAlertRunHistoryLimit(input?.limit);
    const windowHours = this.normalizeAlertDeliveryWindowHours(
      input?.windowHours,
    );
    const history = await this.getAlertRunHistory({
      limit,
      windowHours,
    });
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        limit,
        windowHours,
        runCount: history.length,
        runs: history,
      }),
    };
  }

  async purgeAlertRunRetentionData(input?: {
    retentionDays?: number | null;
  }): Promise<{
    deletedRuns: number;
    retentionDays: number;
    executedAtIso: string;
  }> {
    const retentionDays = this.normalizeAlertRunRetentionDays(
      input?.retentionDays,
    );
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const deleteResult = await this.alertRunRepo.delete({
      evaluatedAt: LessThan(cutoffDate),
    });
    const deletedRuns = Number(deleteResult.affected || 0);
    const executedAtIso = new Date().toISOString();
    this.logger.log(
      `agent-platform-alerts: run retention purge deleted=${deletedRuns} retentionDays=${retentionDays}`,
    );
    return {
      deletedRuns,
      retentionDays,
      executedAtIso,
    };
  }

  async getAlertDeliveryStats(input?: {
    windowHours?: number | null;
  }): Promise<{
    windowHours: number;
    totalCount: number;
    warningCount: number;
    criticalCount: number;
    uniqueRecipients: number;
    lastAlertAtIso?: string;
  }> {
    const windowHours = this.normalizeAlertDeliveryWindowHours(
      input?.windowHours,
    );
    const notifications = await this.resolveAlertDeliveryRows(windowHours);
    let warningCount = 0;
    let criticalCount = 0;
    let lastAlertAtMs = 0;
    const recipients = new Set<string>();

    for (const notification of notifications) {
      const severity = this.normalizeSeverity(
        notification.metadata?.alertSeverity,
      );
      if (severity === 'WARNING') warningCount += 1;
      if (severity === 'CRITICAL') criticalCount += 1;
      const normalizedUserId = String(notification.userId || '').trim();
      if (normalizedUserId) recipients.add(normalizedUserId);
      const createdAtMs = notification.createdAt.getTime();
      if (createdAtMs > lastAlertAtMs) {
        lastAlertAtMs = createdAtMs;
      }
    }
    return {
      windowHours,
      totalCount: notifications.length,
      warningCount,
      criticalCount,
      uniqueRecipients: recipients.size,
      lastAlertAtIso: lastAlertAtMs
        ? new Date(lastAlertAtMs).toISOString()
        : undefined,
    };
  }

  async getAlertDeliverySeries(input?: {
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<
    Array<{
      bucketStartIso: string;
      totalCount: number;
      warningCount: number;
      criticalCount: number;
      uniqueRecipients: number;
    }>
  > {
    const windowHours = this.normalizeAlertDeliveryWindowHours(
      input?.windowHours,
    );
    const bucketMinutes = this.normalizeAlertDeliveryBucketMinutes(
      input?.bucketMinutes,
    );
    const notifications = await this.resolveAlertDeliveryRows(windowHours);
    const bucketMs = bucketMinutes * 60 * 1000;
    const nowMs = Date.now();
    const windowStartMs = nowMs - windowHours * 60 * 60 * 1000;
    const normalizedWindowStartMs =
      Math.floor(windowStartMs / bucketMs) * bucketMs;
    const buckets = new Map<
      number,
      {
        totalCount: number;
        warningCount: number;
        criticalCount: number;
        recipients: Set<string>;
      }
    >();
    for (const notification of notifications) {
      const bucketStartMs =
        Math.floor(notification.createdAt.getTime() / bucketMs) * bucketMs;
      const existing = buckets.get(bucketStartMs) || {
        totalCount: 0,
        warningCount: 0,
        criticalCount: 0,
        recipients: new Set<string>(),
      };
      existing.totalCount += 1;
      const severity = this.normalizeSeverity(
        notification.metadata?.alertSeverity,
      );
      if (severity === 'WARNING') existing.warningCount += 1;
      if (severity === 'CRITICAL') existing.criticalCount += 1;
      const normalizedUserId = String(notification.userId || '').trim();
      if (normalizedUserId) {
        existing.recipients.add(normalizedUserId);
      }
      buckets.set(bucketStartMs, existing);
    }
    const series: Array<{
      bucketStartIso: string;
      totalCount: number;
      warningCount: number;
      criticalCount: number;
      uniqueRecipients: number;
    }> = [];
    for (
      let cursor = normalizedWindowStartMs;
      cursor <= nowMs;
      cursor += bucketMs
    ) {
      const bucket = buckets.get(cursor);
      series.push({
        bucketStartIso: new Date(cursor).toISOString(),
        totalCount: bucket?.totalCount || 0,
        warningCount: bucket?.warningCount || 0,
        criticalCount: bucket?.criticalCount || 0,
        uniqueRecipients: bucket?.recipients.size || 0,
      });
    }
    return series;
  }

  async exportAlertDeliveryData(input?: {
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<{
    generatedAtIso: string;
    dataJson: string;
  }> {
    const windowHours = this.normalizeAlertDeliveryWindowHours(
      input?.windowHours,
    );
    const bucketMinutes = this.normalizeAlertDeliveryBucketMinutes(
      input?.bucketMinutes,
    );
    const [stats, series] = await Promise.all([
      this.getAlertDeliveryStats({
        windowHours,
      }),
      this.getAlertDeliverySeries({
        windowHours,
        bucketMinutes,
      }),
    ]);
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        windowHours,
        bucketMinutes,
        stats,
        series,
      }),
    };
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
    const alertErrorRatePercent = this.resolveAlertErrorRateWarnPercent();
    const alertLatencyMs = this.resolveAlertLatencyWarnMs();

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
    const includeAdminRoleScan = this.isAdminRoleScanEnabled();
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

  private normalizeAlertDeliveryWindowHours(
    windowHours?: number | null,
  ): number {
    return this.resolvePositiveInteger({
      rawValue: windowHours,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ALERT_DELIVERY_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: 24 * 30,
    });
  }

  private normalizeAlertDeliveryBucketMinutes(
    bucketMinutes?: number | null,
  ): number {
    return this.resolvePositiveInteger({
      rawValue: bucketMinutes,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ALERT_DELIVERY_BUCKET_MINUTES,
      minimumValue:
        AiAgentPlatformHealthAlertScheduler.MIN_ALERT_DELIVERY_BUCKET_MINUTES,
      maximumValue:
        AiAgentPlatformHealthAlertScheduler.MAX_ALERT_DELIVERY_BUCKET_MINUTES,
    });
  }

  private async resolveAlertDeliveryRows(
    windowHours: number,
  ): Promise<UserNotification[]> {
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    return this.notificationRepo.find({
      where: {
        type: 'AI_AGENT_PLATFORM_HEALTH_ALERT',
        createdAt: MoreThanOrEqual(windowStartDate),
      },
      order: {
        createdAt: 'ASC',
      },
      take: AiAgentPlatformHealthAlertScheduler.MAX_ALERT_DELIVERY_SAMPLE_SCAN,
    });
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

  private normalizeAlertRunHistoryLimit(limit?: number | null): number {
    return this.resolvePositiveInteger({
      rawValue: limit,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ALERT_RUN_HISTORY_LIMIT,
      minimumValue: 1,
      maximumValue:
        AiAgentPlatformHealthAlertScheduler.MAX_ALERT_RUN_HISTORY_LIMIT,
    });
  }

  private normalizeAlertRunRetentionDays(
    retentionDays?: number | null,
  ): number {
    return this.resolvePositiveInteger({
      rawValue:
        retentionDays ?? process.env.AI_AGENT_HEALTH_ALERT_RUN_RETENTION_DAYS,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ALERT_RUN_RETENTION_DAYS,
      minimumValue: 1,
      maximumValue: 3650,
    });
  }

  private normalizeAlertRunReasons(rawValue: unknown): string[] {
    if (!Array.isArray(rawValue)) return [];
    const normalizedReasons: string[] = [];
    for (const value of rawValue) {
      if (typeof value === 'string') {
        const normalized = value.trim();
        if (normalized) normalizedReasons.push(normalized);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        normalizedReasons.push(String(value));
      }
    }
    return normalizedReasons;
  }

  private async persistAlertRun(
    result: AgentPlatformHealthAlertCheckResult,
    config: {
      anomalyMultiplier: number;
      anomalyMinErrorDeltaPercent: number;
      anomalyMinLatencyDeltaMs: number;
      errorRateWarnPercent: number;
      latencyWarnMs: number;
    },
  ): Promise<void> {
    try {
      await this.alertRunRepo.save(
        this.alertRunRepo.create({
          alertsEnabled: result.alertsEnabled,
          severity: result.severity || null,
          reasons: result.reasons,
          windowHours: result.windowHours,
          baselineWindowHours: result.baselineWindowHours,
          cooldownMinutes: result.cooldownMinutes,
          minSampleCount: result.minSampleCount,
          anomalyMultiplier: config.anomalyMultiplier,
          anomalyMinErrorDeltaPercent: config.anomalyMinErrorDeltaPercent,
          anomalyMinLatencyDeltaMs: config.anomalyMinLatencyDeltaMs,
          errorRateWarnPercent: config.errorRateWarnPercent,
          latencyWarnMs: config.latencyWarnMs,
          recipientCount: result.recipientCount,
          publishedCount: result.publishedCount,
          evaluatedAt: new Date(result.evaluatedAtIso),
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `agent-platform-alerts: failed persisting run snapshot: ${message}`,
      );
    }
  }

  private normalizeCsv(rawValue?: string): string[] {
    return String(rawValue || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private isAdminRoleScanEnabled(): boolean {
    const normalized = String(
      process.env.AI_AGENT_HEALTH_ALERT_SCAN_ADMIN_USERS || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  private resolveAlertErrorRateWarnPercent(): number {
    return this.resolvePositiveFloat({
      rawValue: process.env.AI_AGENT_ALERT_ERROR_RATE_PERCENT,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ALERT_ERROR_RATE_PERCENT,
      minimumValue: 0,
      maximumValue: 100,
    });
  }

  private resolveAlertLatencyWarnMs(): number {
    return this.resolvePositiveFloat({
      rawValue: process.env.AI_AGENT_ALERT_LATENCY_MS,
      fallbackValue:
        AiAgentPlatformHealthAlertScheduler.DEFAULT_ALERT_LATENCY_MS,
      minimumValue: 1,
      maximumValue: 60_000,
    });
  }

  private resolvePositiveInteger(input: {
    rawValue?: string | number | null;
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
    rawValue?: string | number | null;
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
