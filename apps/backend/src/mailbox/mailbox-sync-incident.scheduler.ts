import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { NotificationService } from '../notification/notification.service';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { MailboxSyncRun } from './entities/mailbox-sync-run.entity';
import { MailboxSyncService } from './mailbox-sync.service';

type MailboxSyncIncidentStatus = 'WARNING' | 'CRITICAL' | 'HEALTHY' | 'NO_DATA';
type MailboxSyncIncidentMonitorConfig = {
  alertsEnabled: boolean;
  windowHours: number;
  cooldownMinutes: number;
  maxUsersPerRun: number;
  warningRatePercent: number;
  criticalRatePercent: number;
  minIncidentRuns: number;
};

@Injectable()
export class MailboxSyncIncidentScheduler {
  private static readonly DEFAULT_WINDOW_HOURS = 24;
  private static readonly DEFAULT_COOLDOWN_MINUTES = 60;
  private static readonly DEFAULT_MAX_USERS_PER_RUN = 500;
  private static readonly DEFAULT_WARNING_RATE_PERCENT = 10;
  private static readonly DEFAULT_CRITICAL_RATE_PERCENT = 25;
  private static readonly DEFAULT_MIN_INCIDENT_RUNS = 1;
  private static readonly ALERTABLE_STATUSES = new Set(['WARNING', 'CRITICAL']);
  private readonly logger = new Logger(MailboxSyncIncidentScheduler.name);

  constructor(
    @InjectRepository(MailboxSyncRun)
    private readonly mailboxSyncRunRepo: Repository<MailboxSyncRun>,
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
    private readonly mailboxSyncService: MailboxSyncService,
    private readonly notificationService: NotificationService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  private isIncidentAlertsEnabled(): boolean {
    const normalized = String(
      process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERTS_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  private resolveMonitorConfig(): MailboxSyncIncidentMonitorConfig {
    const windowHours = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WINDOW_HOURS,
      fallbackValue: MailboxSyncIncidentScheduler.DEFAULT_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: 168,
    });
    const cooldownMinutes = this.resolvePositiveInteger({
      rawValue:
        process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_COOLDOWN_MINUTES,
      fallbackValue: MailboxSyncIncidentScheduler.DEFAULT_COOLDOWN_MINUTES,
      minimumValue: 1,
      maximumValue: 24 * 60,
    });
    const maxUsersPerRun = this.resolvePositiveInteger({
      rawValue:
        process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MAX_USERS_PER_RUN,
      fallbackValue: MailboxSyncIncidentScheduler.DEFAULT_MAX_USERS_PER_RUN,
      minimumValue: 1,
      maximumValue: 5000,
    });
    const warningRatePercent = this.resolvePercentage({
      rawValue:
        process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_WARNING_RATE_PERCENT,
      fallbackValue: MailboxSyncIncidentScheduler.DEFAULT_WARNING_RATE_PERCENT,
    });
    const criticalRatePercent = Math.max(
      warningRatePercent,
      this.resolvePercentage({
        rawValue:
          process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_CRITICAL_RATE_PERCENT,
        fallbackValue:
          MailboxSyncIncidentScheduler.DEFAULT_CRITICAL_RATE_PERCENT,
      }),
    );
    const minIncidentRuns = this.resolvePositiveInteger({
      rawValue:
        process.env.MAILZEN_MAILBOX_SYNC_INCIDENT_ALERT_MIN_INCIDENT_RUNS,
      fallbackValue: MailboxSyncIncidentScheduler.DEFAULT_MIN_INCIDENT_RUNS,
      minimumValue: 1,
      maximumValue: 5000,
    });
    return {
      alertsEnabled: this.isIncidentAlertsEnabled(),
      windowHours,
      cooldownMinutes,
      maxUsersPerRun,
      warningRatePercent,
      criticalRatePercent,
      minIncidentRuns,
    };
  }

  getIncidentAlertConfigSnapshot(): {
    alertsEnabled: boolean;
    windowHours: number;
    cooldownMinutes: number;
    maxUsersPerRun: number;
    warningRatePercent: number;
    criticalRatePercent: number;
    minIncidentRuns: number;
    evaluatedAtIso: string;
  } {
    const config = this.resolveMonitorConfig();
    return {
      alertsEnabled: config.alertsEnabled,
      windowHours: config.windowHours,
      cooldownMinutes: config.cooldownMinutes,
      maxUsersPerRun: config.maxUsersPerRun,
      warningRatePercent: config.warningRatePercent,
      criticalRatePercent: config.criticalRatePercent,
      minIncidentRuns: config.minIncidentRuns,
      evaluatedAtIso: new Date().toISOString(),
    };
  }

  async runIncidentAlertCheck(input: {
    userId: string;
    windowHours?: number | null;
    warningRatePercent?: number | null;
    criticalRatePercent?: number | null;
    minIncidentRuns?: number | null;
  }): Promise<{
    alertsEnabled: boolean;
    evaluatedAtIso: string;
    windowHours: number;
    warningRatePercent: number;
    criticalRatePercent: number;
    minIncidentRuns: number;
    status: string;
    statusReason: string;
    shouldAlert: boolean;
    totalRuns: number;
    incidentRuns: number;
    failedRuns: number;
    partialRuns: number;
    incidentRatePercent: number;
    lastIncidentAtIso?: string;
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
    const warningRatePercent = this.resolvePercentage({
      rawValue:
        typeof input.warningRatePercent === 'number' &&
        Number.isFinite(input.warningRatePercent)
          ? String(input.warningRatePercent)
          : undefined,
      fallbackValue: baseConfig.warningRatePercent,
    });
    const criticalRatePercent = Math.max(
      warningRatePercent,
      this.resolvePercentage({
        rawValue:
          typeof input.criticalRatePercent === 'number' &&
          Number.isFinite(input.criticalRatePercent)
            ? String(input.criticalRatePercent)
            : undefined,
        fallbackValue: baseConfig.criticalRatePercent,
      }),
    );
    const minIncidentRuns = this.resolvePositiveInteger({
      rawValue:
        typeof input.minIncidentRuns === 'number' &&
        Number.isFinite(input.minIncidentRuns)
          ? String(input.minIncidentRuns)
          : undefined,
      fallbackValue: baseConfig.minIncidentRuns,
      minimumValue: 1,
      maximumValue: 5000,
    });
    const evaluatedAtIso = new Date().toISOString();
    if (!baseConfig.alertsEnabled) {
      return {
        alertsEnabled: false,
        evaluatedAtIso,
        windowHours,
        warningRatePercent,
        criticalRatePercent,
        minIncidentRuns,
        status: 'NO_DATA',
        statusReason: 'alerts-disabled',
        shouldAlert: false,
        totalRuns: 0,
        incidentRuns: 0,
        failedRuns: 0,
        partialRuns: 0,
        incidentRatePercent: 0,
      };
    }

    const stats =
      await this.mailboxSyncService.getMailboxSyncIncidentStatsForUser({
        userId: input.userId,
        windowHours,
      });
    const resolvedStatus = this.resolveIncidentStatus({
      totalRuns: stats.totalRuns,
      incidentRuns: stats.incidentRuns,
      incidentRatePercent: stats.incidentRatePercent,
      warningRatePercent,
      criticalRatePercent,
      minIncidentRuns,
    });
    return {
      alertsEnabled: true,
      evaluatedAtIso,
      windowHours,
      warningRatePercent,
      criticalRatePercent,
      minIncidentRuns,
      status: resolvedStatus,
      statusReason: this.resolveIncidentStatusReason({
        status: resolvedStatus,
        totalRuns: stats.totalRuns,
        incidentRuns: stats.incidentRuns,
        incidentRatePercent: stats.incidentRatePercent,
        warningRatePercent,
        criticalRatePercent,
        minIncidentRuns,
      }),
      shouldAlert:
        MailboxSyncIncidentScheduler.ALERTABLE_STATUSES.has(resolvedStatus),
      totalRuns: stats.totalRuns,
      incidentRuns: stats.incidentRuns,
      failedRuns: stats.failedRuns,
      partialRuns: stats.partialRuns,
      incidentRatePercent: stats.incidentRatePercent,
      lastIncidentAtIso: stats.lastIncidentAtIso,
    };
  }

  @Cron('*/15 * * * *')
  async monitorMailboxSyncIncidents(): Promise<void> {
    const config = this.resolveMonitorConfig();
    if (!config.alertsEnabled) {
      this.logger.log('mailbox-sync-incident: alerts disabled by env');
      return;
    }
    const monitoredUserIds = await this.resolveMonitoredUserIds({
      windowHours: config.windowHours,
      maxUsersPerRun: config.maxUsersPerRun,
    });
    if (!monitoredUserIds.length) return;

    this.logger.log(
      serializeStructuredLog({
        event: 'mailbox_sync_incident_monitor_start',
        monitoredUsers: monitoredUserIds.length,
        windowHours: config.windowHours,
        cooldownMinutes: config.cooldownMinutes,
        warningRatePercent: config.warningRatePercent,
        criticalRatePercent: config.criticalRatePercent,
        minIncidentRuns: config.minIncidentRuns,
      }),
    );

    for (const userId of monitoredUserIds) {
      await this.monitorUserMailboxSyncIncidents({
        userId,
        windowHours: config.windowHours,
        cooldownMinutes: config.cooldownMinutes,
        warningRatePercent: config.warningRatePercent,
        criticalRatePercent: config.criticalRatePercent,
        minIncidentRuns: config.minIncidentRuns,
      });
    }
  }

  private async resolveMonitoredUserIds(input: {
    windowHours: number;
    maxUsersPerRun: number;
  }): Promise<string[]> {
    const windowStart = new Date(
      Date.now() - input.windowHours * 60 * 60 * 1000,
    );
    const rows = await this.mailboxSyncRunRepo
      .createQueryBuilder('run')
      .select('DISTINCT run.userId', 'userId')
      .where('run.completedAt >= :windowStart', {
        windowStart: windowStart.toISOString(),
      })
      .orderBy('run.userId', 'ASC')
      .take(input.maxUsersPerRun)
      .getRawMany<{ userId: string }>();
    return rows
      .map((row) => String(row.userId || '').trim())
      .filter((userId) => userId.length > 0);
  }

  private async monitorUserMailboxSyncIncidents(input: {
    userId: string;
    windowHours: number;
    cooldownMinutes: number;
    warningRatePercent: number;
    criticalRatePercent: number;
    minIncidentRuns: number;
  }): Promise<void> {
    try {
      const preferences = await this.notificationService.getOrCreatePreferences(
        input.userId,
      );
      if (!preferences.syncFailureEnabled) {
        return;
      }
      const stats =
        await this.mailboxSyncService.getMailboxSyncIncidentStatsForUser({
          userId: input.userId,
          windowHours: input.windowHours,
        });
      const status = this.resolveIncidentStatus({
        totalRuns: stats.totalRuns,
        incidentRuns: stats.incidentRuns,
        incidentRatePercent: stats.incidentRatePercent,
        warningRatePercent: input.warningRatePercent,
        criticalRatePercent: input.criticalRatePercent,
        minIncidentRuns: input.minIncidentRuns,
      });
      const shouldAlert =
        MailboxSyncIncidentScheduler.ALERTABLE_STATUSES.has(status);
      if (!shouldAlert) return;

      const effectiveCooldownMinutes = this.resolvePositiveInteger({
        rawValue:
          preferences.mailboxInboundSlaAlertCooldownMinutes === null ||
          preferences.mailboxInboundSlaAlertCooldownMinutes === undefined
            ? String(input.cooldownMinutes)
            : String(preferences.mailboxInboundSlaAlertCooldownMinutes),
        fallbackValue: input.cooldownMinutes,
        minimumValue: 1,
        maximumValue: 24 * 60,
      });
      const previousAlert = await this.notificationRepo.findOne({
        where: {
          userId: input.userId,
          type: 'MAILBOX_SYNC_INCIDENT_ALERT',
        },
        order: {
          createdAt: 'DESC',
        },
      });
      const previousStatus = this.resolveStoredAlertStatus(
        previousAlert?.metadata,
      );
      const previousAlertAt = previousAlert?.createdAt || null;
      const statusUnchanged = previousStatus === status;
      const cooldownActive =
        statusUnchanged &&
        this.isCooldownActive(previousAlertAt, effectiveCooldownMinutes);
      if (cooldownActive) {
        this.logger.log(
          serializeStructuredLog({
            event: 'mailbox_sync_incident_alert_suppressed',
            userId: input.userId,
            incidentStatus: status,
            reason: 'cooldown-active',
          }),
        );
        return;
      }

      await this.notificationEventBus.publishSafely({
        userId: input.userId,
        type: 'MAILBOX_SYNC_INCIDENT_ALERT',
        title:
          status === 'CRITICAL'
            ? 'Mailbox sync incidents are critical'
            : 'Mailbox sync incidents detected',
        message: `Mailbox sync incident rate is ${stats.incidentRatePercent}% (${stats.incidentRuns}/${stats.totalRuns}) over the last ${stats.windowHours}h.`,
        metadata: {
          incidentStatus: status,
          incidentRatePercent: stats.incidentRatePercent,
          incidentRuns: stats.incidentRuns,
          totalRuns: stats.totalRuns,
          failedRuns: stats.failedRuns,
          partialRuns: stats.partialRuns,
          warningRatePercent: input.warningRatePercent,
          criticalRatePercent: input.criticalRatePercent,
          windowHours: stats.windowHours,
          source: 'mailbox-sync-incident-scheduler',
          lastIncidentAtIso: stats.lastIncidentAtIso || null,
        },
      });
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_incident_alert_emitted',
          userId: input.userId,
          incidentStatus: status,
          incidentRatePercent: stats.incidentRatePercent,
          incidentRuns: stats.incidentRuns,
          totalRuns: stats.totalRuns,
        }),
      );
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_incident_monitor_failed',
          userId: input.userId,
          reason,
        }),
      );
    }
  }

  private resolveStoredAlertStatus(
    metadata?: Record<string, unknown> | null,
  ): 'WARNING' | 'CRITICAL' | null {
    const rawStatus = metadata?.incidentStatus;
    const normalized =
      typeof rawStatus === 'string' || typeof rawStatus === 'number'
        ? String(rawStatus).trim().toUpperCase()
        : '';
    if (normalized === 'CRITICAL') return 'CRITICAL';
    if (normalized === 'WARNING') return 'WARNING';
    return null;
  }

  private resolveIncidentStatus(input: {
    totalRuns: number;
    incidentRuns: number;
    incidentRatePercent: number;
    warningRatePercent: number;
    criticalRatePercent: number;
    minIncidentRuns: number;
  }): MailboxSyncIncidentStatus {
    if (input.totalRuns <= 0) return 'NO_DATA';
    if (input.incidentRuns < input.minIncidentRuns) return 'HEALTHY';
    if (input.incidentRatePercent >= input.criticalRatePercent) {
      return 'CRITICAL';
    }
    if (input.incidentRatePercent >= input.warningRatePercent) {
      return 'WARNING';
    }
    return 'HEALTHY';
  }

  private resolveIncidentStatusReason(input: {
    status: MailboxSyncIncidentStatus;
    totalRuns: number;
    incidentRuns: number;
    incidentRatePercent: number;
    warningRatePercent: number;
    criticalRatePercent: number;
    minIncidentRuns: number;
  }): string {
    if (input.status === 'NO_DATA') return 'no-data';
    if (input.incidentRuns < input.minIncidentRuns) {
      return 'below-min-incident-runs';
    }
    if (input.status === 'CRITICAL') {
      return `incident-rate ${input.incidentRatePercent}% >= ${input.criticalRatePercent}%`;
    }
    if (input.status === 'WARNING') {
      return `incident-rate ${input.incidentRatePercent}% >= ${input.warningRatePercent}%`;
    }
    return 'incident-rate-healthy';
  }

  private isCooldownActive(
    previousAlertedAt: Date | null,
    cooldownMinutes: number,
  ): boolean {
    if (!previousAlertedAt) return false;
    return (
      Date.now() - previousAlertedAt.getTime() < cooldownMinutes * 60 * 1000
    );
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

  private resolvePercentage(input: {
    rawValue?: string;
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
}
