import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { NotificationService } from '../notification/notification.service';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderService } from './email-provider.service';

type ProviderSyncIncidentStatus =
  | 'WARNING'
  | 'CRITICAL'
  | 'HEALTHY'
  | 'NO_DATA';

type ProviderSyncIncidentMonitorConfig = {
  alertsEnabled: boolean;
  windowHours: number;
  cooldownMinutes: number;
  maxUsersPerRun: number;
  warningErrorProviderPercent: number;
  criticalErrorProviderPercent: number;
  minErrorProviders: number;
};

@Injectable()
export class ProviderSyncIncidentScheduler {
  private static readonly DEFAULT_WINDOW_HOURS = 24;
  private static readonly DEFAULT_COOLDOWN_MINUTES = 60;
  private static readonly DEFAULT_MAX_USERS_PER_RUN = 500;
  private static readonly DEFAULT_WARNING_ERROR_PROVIDER_PERCENT = 20;
  private static readonly DEFAULT_CRITICAL_ERROR_PROVIDER_PERCENT = 50;
  private static readonly DEFAULT_MIN_ERROR_PROVIDERS = 1;
  private static readonly ALERTABLE_STATUSES = new Set(['WARNING', 'CRITICAL']);
  private readonly logger = new Logger(ProviderSyncIncidentScheduler.name);

  constructor(
    @InjectRepository(EmailProvider)
    private readonly providerRepository: Repository<EmailProvider>,
    @InjectRepository(UserNotification)
    private readonly notificationRepository: Repository<UserNotification>,
    private readonly emailProviderService: EmailProviderService,
    private readonly notificationService: NotificationService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  private isIncidentAlertsEnabled(): boolean {
    const normalized = String(
      process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERTS_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
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

  private resolvePercentage(input: {
    rawValue?: string | number | null;
    fallbackValue: number;
  }): number {
    const parsedValue = Number(input.rawValue);
    const candidate = Number.isFinite(parsedValue)
      ? parsedValue
      : input.fallbackValue;
    if (candidate < 0) return 0;
    if (candidate > 100) return 100;
    return Math.round(candidate * 100) / 100;
  }

  private resolveMonitorConfig(): ProviderSyncIncidentMonitorConfig {
    const windowHours = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_WINDOW_HOURS,
      fallbackValue: ProviderSyncIncidentScheduler.DEFAULT_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: 168,
    });
    const cooldownMinutes = this.resolvePositiveInteger({
      rawValue:
        process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_COOLDOWN_MINUTES,
      fallbackValue: ProviderSyncIncidentScheduler.DEFAULT_COOLDOWN_MINUTES,
      minimumValue: 1,
      maximumValue: 24 * 60,
    });
    const maxUsersPerRun = this.resolvePositiveInteger({
      rawValue:
        process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_MAX_USERS_PER_RUN,
      fallbackValue: ProviderSyncIncidentScheduler.DEFAULT_MAX_USERS_PER_RUN,
      minimumValue: 1,
      maximumValue: 5000,
    });
    const warningErrorProviderPercent = this.resolvePercentage({
      rawValue:
        process.env
          .MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_WARNING_ERROR_PROVIDER_PERCENT,
      fallbackValue:
        ProviderSyncIncidentScheduler.DEFAULT_WARNING_ERROR_PROVIDER_PERCENT,
    });
    const criticalErrorProviderPercent = Math.max(
      warningErrorProviderPercent,
      this.resolvePercentage({
        rawValue:
          process.env
            .MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_CRITICAL_ERROR_PROVIDER_PERCENT,
        fallbackValue:
          ProviderSyncIncidentScheduler.DEFAULT_CRITICAL_ERROR_PROVIDER_PERCENT,
      }),
    );
    const minErrorProviders = this.resolvePositiveInteger({
      rawValue:
        process.env.MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_MIN_ERROR_PROVIDERS,
      fallbackValue: ProviderSyncIncidentScheduler.DEFAULT_MIN_ERROR_PROVIDERS,
      minimumValue: 1,
      maximumValue: 5000,
    });
    return {
      alertsEnabled: this.isIncidentAlertsEnabled(),
      windowHours,
      cooldownMinutes,
      maxUsersPerRun,
      warningErrorProviderPercent,
      criticalErrorProviderPercent,
      minErrorProviders,
    };
  }

  async getIncidentAlertConfigSnapshot(input: { userId: string }): Promise<{
    alertsEnabled: boolean;
    syncFailureEnabled: boolean;
    windowHours: number;
    cooldownMinutes: number;
    maxUsersPerRun: number;
    warningErrorProviderPercent: number;
    criticalErrorProviderPercent: number;
    minErrorProviders: number;
    evaluatedAtIso: string;
  }> {
    const config = this.resolveMonitorConfig();
    const preferences = await this.notificationService.getOrCreatePreferences(
      input.userId,
    );
    return {
      alertsEnabled: config.alertsEnabled,
      syncFailureEnabled: preferences.syncFailureEnabled,
      windowHours: config.windowHours,
      cooldownMinutes: config.cooldownMinutes,
      maxUsersPerRun: config.maxUsersPerRun,
      warningErrorProviderPercent: config.warningErrorProviderPercent,
      criticalErrorProviderPercent: config.criticalErrorProviderPercent,
      minErrorProviders: config.minErrorProviders,
      evaluatedAtIso: new Date().toISOString(),
    };
  }

  private resolveIncidentStatus(input: {
    totalProviders: number;
    errorProviders: number;
    errorProviderPercent: number;
    warningErrorProviderPercent: number;
    criticalErrorProviderPercent: number;
    minErrorProviders: number;
  }): ProviderSyncIncidentStatus {
    if (input.totalProviders <= 0) return 'NO_DATA';
    if (input.errorProviders < input.minErrorProviders) return 'HEALTHY';
    if (input.errorProviderPercent >= input.criticalErrorProviderPercent) {
      return 'CRITICAL';
    }
    if (input.errorProviderPercent >= input.warningErrorProviderPercent) {
      return 'WARNING';
    }
    return 'HEALTHY';
  }

  private resolveIncidentStatusReason(input: {
    status: ProviderSyncIncidentStatus;
    totalProviders: number;
    errorProviders: number;
    errorProviderPercent: number;
    warningErrorProviderPercent: number;
    criticalErrorProviderPercent: number;
    minErrorProviders: number;
  }): string {
    if (input.totalProviders <= 0 || input.status === 'NO_DATA') {
      return 'no-providers-in-window';
    }
    if (input.errorProviders < input.minErrorProviders) {
      return `error-providers ${input.errorProviders} below min ${input.minErrorProviders}`;
    }
    if (input.status === 'CRITICAL') {
      return `error-provider-percent ${input.errorProviderPercent}% >= ${input.criticalErrorProviderPercent}%`;
    }
    if (input.status === 'WARNING') {
      return `error-provider-percent ${input.errorProviderPercent}% >= ${input.warningErrorProviderPercent}%`;
    }
    return 'within-threshold';
  }

  async runIncidentAlertCheck(input: {
    userId: string;
    windowHours?: number | null;
    warningErrorProviderPercent?: number | null;
    criticalErrorProviderPercent?: number | null;
    minErrorProviders?: number | null;
    syncFailureEnabledOverride?: boolean | null;
  }): Promise<{
    alertsEnabled: boolean;
    syncFailureEnabled: boolean;
    evaluatedAtIso: string;
    windowHours: number;
    warningErrorProviderPercent: number;
    criticalErrorProviderPercent: number;
    minErrorProviders: number;
    status: string;
    statusReason: string;
    shouldAlert: boolean;
    totalProviders: number;
    connectedProviders: number;
    syncingProviders: number;
    errorProviders: number;
    errorProviderPercent: number;
  }> {
    const baseConfig = this.resolveMonitorConfig();
    const windowHours = this.resolvePositiveInteger({
      rawValue:
        typeof input.windowHours === 'number' &&
        Number.isFinite(input.windowHours)
          ? String(input.windowHours)
          : undefined,
      fallbackValue: baseConfig.windowHours,
      minimumValue: 1,
      maximumValue: 168,
    });
    const warningErrorProviderPercent = this.resolvePercentage({
      rawValue:
        typeof input.warningErrorProviderPercent === 'number' &&
        Number.isFinite(input.warningErrorProviderPercent)
          ? String(input.warningErrorProviderPercent)
          : undefined,
      fallbackValue: baseConfig.warningErrorProviderPercent,
    });
    const criticalErrorProviderPercent = Math.max(
      warningErrorProviderPercent,
      this.resolvePercentage({
        rawValue:
          typeof input.criticalErrorProviderPercent === 'number' &&
          Number.isFinite(input.criticalErrorProviderPercent)
            ? String(input.criticalErrorProviderPercent)
            : undefined,
        fallbackValue: baseConfig.criticalErrorProviderPercent,
      }),
    );
    const minErrorProviders = this.resolvePositiveInteger({
      rawValue:
        typeof input.minErrorProviders === 'number' &&
        Number.isFinite(input.minErrorProviders)
          ? String(input.minErrorProviders)
          : undefined,
      fallbackValue: baseConfig.minErrorProviders,
      minimumValue: 1,
      maximumValue: 5000,
    });
    const evaluatedAtIso = new Date().toISOString();
    const syncFailureEnabled =
      typeof input.syncFailureEnabledOverride === 'boolean'
        ? input.syncFailureEnabledOverride
        : (await this.notificationService.getOrCreatePreferences(input.userId))
            .syncFailureEnabled;
    if (!baseConfig.alertsEnabled) {
      return {
        alertsEnabled: false,
        syncFailureEnabled,
        evaluatedAtIso,
        windowHours,
        warningErrorProviderPercent,
        criticalErrorProviderPercent,
        minErrorProviders,
        status: 'NO_DATA',
        statusReason: 'alerts-disabled-by-env',
        shouldAlert: false,
        totalProviders: 0,
        connectedProviders: 0,
        syncingProviders: 0,
        errorProviders: 0,
        errorProviderPercent: 0,
      };
    }

    const stats = await this.emailProviderService.getProviderSyncStatsForUser({
      userId: input.userId,
      windowHours,
    });
    const errorProviderPercent =
      stats.totalProviders > 0
        ? Math.round((stats.errorProviders / stats.totalProviders) * 10000) /
          100
        : 0;
    const status = this.resolveIncidentStatus({
      totalProviders: stats.totalProviders,
      errorProviders: stats.errorProviders,
      errorProviderPercent,
      warningErrorProviderPercent,
      criticalErrorProviderPercent,
      minErrorProviders,
    });
    const statusReason =
      !syncFailureEnabled &&
      ProviderSyncIncidentScheduler.ALERTABLE_STATUSES.has(status)
        ? 'sync-failure-alerts-disabled-by-preference'
        : this.resolveIncidentStatusReason({
            status,
            totalProviders: stats.totalProviders,
            errorProviders: stats.errorProviders,
            errorProviderPercent,
            warningErrorProviderPercent,
            criticalErrorProviderPercent,
            minErrorProviders,
          });
    return {
      alertsEnabled: true,
      syncFailureEnabled,
      evaluatedAtIso,
      windowHours,
      warningErrorProviderPercent,
      criticalErrorProviderPercent,
      minErrorProviders,
      status,
      statusReason,
      shouldAlert:
        syncFailureEnabled &&
        ProviderSyncIncidentScheduler.ALERTABLE_STATUSES.has(status),
      totalProviders: stats.totalProviders,
      connectedProviders: stats.connectedProviders,
      syncingProviders: stats.syncingProviders,
      errorProviders: stats.errorProviders,
      errorProviderPercent,
    };
  }

  @Cron('*/15 * * * *')
  async monitorProviderSyncIncidents(): Promise<void> {
    const runCorrelationId = resolveCorrelationId(undefined);
    const config = this.resolveMonitorConfig();
    if (!config.alertsEnabled) {
      this.logger.log(
        serializeStructuredLog({
          event: 'provider_sync_incident_alerts_disabled',
          runCorrelationId,
        }),
      );
      return;
    }
    const monitoredUserIds = await this.resolveMonitoredUserIds({
      maxUsersPerRun: config.maxUsersPerRun,
    });
    if (!monitoredUserIds.length) return;
    this.logger.log(
      serializeStructuredLog({
        event: 'provider_sync_incident_monitor_start',
        runCorrelationId,
        monitoredUsers: monitoredUserIds.length,
        windowHours: config.windowHours,
        cooldownMinutes: config.cooldownMinutes,
        warningErrorProviderPercent: config.warningErrorProviderPercent,
        criticalErrorProviderPercent: config.criticalErrorProviderPercent,
        minErrorProviders: config.minErrorProviders,
      }),
    );

    for (const userId of monitoredUserIds) {
      await this.monitorProviderSyncIncidentsForUser({
        userId,
        runCorrelationId,
        windowHours: config.windowHours,
        cooldownMinutes: config.cooldownMinutes,
        warningErrorProviderPercent: config.warningErrorProviderPercent,
        criticalErrorProviderPercent: config.criticalErrorProviderPercent,
        minErrorProviders: config.minErrorProviders,
      });
    }
  }

  private async resolveMonitoredUserIds(input: {
    maxUsersPerRun: number;
  }): Promise<string[]> {
    const rows = await this.providerRepository
      .createQueryBuilder('provider')
      .select('DISTINCT provider.userId', 'userId')
      .where('provider.isActive = :isActive', { isActive: true })
      .orderBy('provider.userId', 'ASC')
      .take(input.maxUsersPerRun)
      .getRawMany<{ userId: string }>();
    return rows
      .map((row) => String(row.userId || '').trim())
      .filter((value) => value.length > 0);
  }

  private resolveStoredAlertStatus(
    notification?: UserNotification | null,
  ): 'WARNING' | 'CRITICAL' | null {
    const rawStatus = notification?.metadata?.status;
    if (typeof rawStatus !== 'string') return null;
    const normalizedStatus = rawStatus.trim().toUpperCase();
    if (normalizedStatus === 'WARNING') return 'WARNING';
    if (normalizedStatus === 'CRITICAL') return 'CRITICAL';
    return null;
  }

  private isCooldownActive(input: {
    previousAlert?: UserNotification | null;
    status: string;
    cooldownMinutes: number;
  }): boolean {
    if (!input.previousAlert) return false;
    const previousStatus = this.resolveStoredAlertStatus(input.previousAlert);
    if (previousStatus !== input.status) return false;
    return (
      Date.now() - input.previousAlert.createdAt.getTime() <
      input.cooldownMinutes * 60 * 1000
    );
  }

  private async monitorProviderSyncIncidentsForUser(input: {
    userId: string;
    runCorrelationId: string;
    windowHours: number;
    cooldownMinutes: number;
    warningErrorProviderPercent: number;
    criticalErrorProviderPercent: number;
    minErrorProviders: number;
  }): Promise<void> {
    try {
      const preferences = await this.notificationService.getOrCreatePreferences(
        input.userId,
      );
      if (!preferences.syncFailureEnabled) {
        this.logger.log(
          serializeStructuredLog({
            event: 'provider_sync_incident_user_skipped_by_preference',
            userId: input.userId,
            runCorrelationId: input.runCorrelationId,
          }),
        );
        return;
      }
      const check = await this.runIncidentAlertCheck({
        userId: input.userId,
        windowHours: input.windowHours,
        warningErrorProviderPercent: input.warningErrorProviderPercent,
        criticalErrorProviderPercent: input.criticalErrorProviderPercent,
        minErrorProviders: input.minErrorProviders,
        syncFailureEnabledOverride: preferences.syncFailureEnabled,
      });
      if (!check.shouldAlert) {
        this.logger.log(
          serializeStructuredLog({
            event: 'provider_sync_incident_user_within_threshold',
            userId: input.userId,
            runCorrelationId: input.runCorrelationId,
            status: check.status,
            statusReason: check.statusReason,
            errorProviderPercent: check.errorProviderPercent,
            errorProviders: check.errorProviders,
            totalProviders: check.totalProviders,
          }),
        );
        return;
      }

      const previousAlert = await this.notificationRepository.findOne({
        where: {
          userId: input.userId,
          type: 'PROVIDER_SYNC_INCIDENT_ALERT',
        },
        order: { createdAt: 'DESC' },
      });
      if (
        this.isCooldownActive({
          previousAlert,
          status: check.status,
          cooldownMinutes: input.cooldownMinutes,
        })
      ) {
        this.logger.log(
          serializeStructuredLog({
            event: 'provider_sync_incident_alert_suppressed_by_cooldown',
            userId: input.userId,
            runCorrelationId: input.runCorrelationId,
            status: check.status,
            cooldownMinutes: input.cooldownMinutes,
          }),
        );
        return;
      }

      await this.notificationEventBus.publishSafely({
        userId: input.userId,
        type: 'PROVIDER_SYNC_INCIDENT_ALERT',
        title:
          check.status === 'CRITICAL'
            ? 'Provider sync incident critical'
            : 'Provider sync incident warning',
        message: `${check.errorProviders} provider(s) are in error state (${check.errorProviderPercent}% of ${check.totalProviders}) over the last ${check.windowHours}h.`,
        metadata: {
          status: check.status,
          statusReason: check.statusReason,
          totalProviders: check.totalProviders,
          connectedProviders: check.connectedProviders,
          syncingProviders: check.syncingProviders,
          errorProviders: check.errorProviders,
          errorProviderPercent: check.errorProviderPercent,
          warningErrorProviderPercent: check.warningErrorProviderPercent,
          criticalErrorProviderPercent: check.criticalErrorProviderPercent,
          minErrorProviders: check.minErrorProviders,
          windowHours: check.windowHours,
          source: 'provider-sync-incident-scheduler',
        },
      });
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_sync_incident_alert_emitted',
          userId: input.userId,
          runCorrelationId: input.runCorrelationId,
          status: check.status,
          statusReason: check.statusReason,
          errorProviderPercent: check.errorProviderPercent,
          errorProviders: check.errorProviders,
          totalProviders: check.totalProviders,
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_sync_incident_monitor_user_failed',
          userId: input.userId,
          runCorrelationId: input.runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
