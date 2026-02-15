import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { NotificationService } from '../notification/notification.service';
import { UserNotificationPreference } from '../notification/entities/user-notification-preference.entity';
import { MailboxInboundEvent } from './entities/mailbox-inbound-event.entity';
import { MailboxService } from './mailbox.service';

type MailboxInboundSlaStatus = 'WARNING' | 'CRITICAL' | 'HEALTHY' | 'NO_DATA';

@Injectable()
export class MailboxInboundSlaScheduler {
  private static readonly DEFAULT_WINDOW_HOURS = 24;
  private static readonly DEFAULT_COOLDOWN_MINUTES = 60;
  private static readonly DEFAULT_MAX_USERS_PER_RUN = 500;
  private static readonly ALERTABLE_STATUSES = new Set(['WARNING', 'CRITICAL']);
  private readonly logger = new Logger(MailboxInboundSlaScheduler.name);

  constructor(
    @InjectRepository(MailboxInboundEvent)
    private readonly mailboxInboundEventRepo: Repository<MailboxInboundEvent>,
    @InjectRepository(UserNotificationPreference)
    private readonly notificationPreferenceRepo: Repository<UserNotificationPreference>,
    private readonly mailboxService: MailboxService,
    private readonly notificationService: NotificationService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  @Cron('*/15 * * * *')
  async monitorMailboxInboundSla() {
    const windowHours = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_INBOUND_SLA_ALERT_WINDOW_HOURS,
      fallbackValue: MailboxInboundSlaScheduler.DEFAULT_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: 168,
    });
    const cooldownMinutes = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_INBOUND_SLA_ALERT_COOLDOWN_MINUTES,
      fallbackValue: MailboxInboundSlaScheduler.DEFAULT_COOLDOWN_MINUTES,
      minimumValue: 1,
      maximumValue: 24 * 60,
    });
    const maxUsersPerRun = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_INBOUND_SLA_ALERT_MAX_USERS_PER_RUN,
      fallbackValue: MailboxInboundSlaScheduler.DEFAULT_MAX_USERS_PER_RUN,
      minimumValue: 1,
      maximumValue: 5000,
    });
    const monitoredUserIds = await this.resolveMonitoredUserIds({
      windowHours,
      maxUsersPerRun,
    });
    if (!monitoredUserIds.length) return;

    this.logger.log(
      `mailbox-sla-monitor: evaluating ${monitoredUserIds.length} users window=${windowHours}h cooldown=${cooldownMinutes}m`,
    );

    for (const userId of monitoredUserIds) {
      await this.monitorUserMailboxInboundSla({
        userId,
        windowHours,
        cooldownMinutes,
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
    const rows = await this.mailboxInboundEventRepo
      .createQueryBuilder('event')
      .select('DISTINCT event.userId', 'userId')
      .where('event.createdAt >= :windowStart', {
        windowStart: windowStart.toISOString(),
      })
      .orderBy('event.userId', 'ASC')
      .take(input.maxUsersPerRun)
      .getRawMany<{ userId: string }>();
    const userIds = rows
      .map((row) => String(row.userId || '').trim())
      .filter((value) => value.length > 0);
    const usersWithAlertState = await this.notificationPreferenceRepo.find({
      select: ['userId'],
      where: [
        { mailboxInboundSlaLastAlertStatus: Not(IsNull()) },
        { mailboxInboundSlaLastAlertedAt: Not(IsNull()) },
      ],
      take: input.maxUsersPerRun,
      order: { updatedAt: 'DESC' },
    });
    for (const preference of usersWithAlertState) {
      const normalizedUserId = String(preference.userId || '').trim();
      if (!normalizedUserId) continue;
      userIds.push(normalizedUserId);
    }
    return Array.from(new Set(userIds)).slice(0, input.maxUsersPerRun);
  }

  private async monitorUserMailboxInboundSla(input: {
    userId: string;
    windowHours: number;
    cooldownMinutes: number;
  }): Promise<void> {
    try {
      const preferences = await this.notificationService.getOrCreatePreferences(
        input.userId,
      );
      if (!preferences.mailboxInboundSlaAlertsEnabled) {
        if (
          preferences.mailboxInboundSlaLastAlertStatus ||
          preferences.mailboxInboundSlaLastAlertedAt
        ) {
          await this.notificationService.updateMailboxInboundSlaAlertState({
            userId: input.userId,
            status: null,
            alertedAt: null,
          });
        }
        return;
      }

      const stats = await this.mailboxService.getInboundEventStats(
        input.userId,
        {
          windowHours: input.windowHours,
        },
      );
      const normalizedStatus = this.normalizeSlaStatus(stats.slaStatus);
      const shouldAlert =
        MailboxInboundSlaScheduler.ALERTABLE_STATUSES.has(normalizedStatus);
      const previousStatus = this.normalizeStoredStatus(
        preferences.mailboxInboundSlaLastAlertStatus,
      );
      const previousAlertAt =
        preferences.mailboxInboundSlaLastAlertedAt || null;
      const effectiveCooldownMinutes = this.resolveCooldownMinutes({
        fallbackCooldownMinutes: input.cooldownMinutes,
        preferenceCooldownMinutes:
          preferences.mailboxInboundSlaAlertCooldownMinutes,
      });
      const statusUnchanged = previousStatus === normalizedStatus;
      const cooldownActive =
        shouldAlert &&
        statusUnchanged &&
        this.isCooldownActive(previousAlertAt, effectiveCooldownMinutes);

      if (cooldownActive) {
        this.logger.log(
          `mailbox-sla-monitor: suppressing duplicate ${normalizedStatus} alert for user=${input.userId}`,
        );
        return;
      }

      if (!shouldAlert) {
        if (previousStatus) {
          await this.notificationService.updateMailboxInboundSlaAlertState({
            userId: input.userId,
            status: null,
            alertedAt: null,
          });
        }
        return;
      }

      await this.notificationEventBus.publishSafely({
        userId: input.userId,
        type: 'MAILBOX_INBOUND_SLA_ALERT',
        title:
          normalizedStatus === 'CRITICAL'
            ? 'Mailbox inbound SLA critical'
            : 'Mailbox inbound SLA warning',
        message: `Inbound success ${stats.successRatePercent}% (target ${stats.slaTargetSuccessPercent}%) and rejection ${stats.rejectionRatePercent}% over the last ${stats.windowHours}h.`,
        metadata: {
          slaStatus: normalizedStatus,
          successRatePercent: stats.successRatePercent,
          rejectionRatePercent: stats.rejectionRatePercent,
          slaTargetSuccessPercent: stats.slaTargetSuccessPercent,
          slaWarningRejectedPercent: stats.slaWarningRejectedPercent,
          slaCriticalRejectedPercent: stats.slaCriticalRejectedPercent,
          totalCount: stats.totalCount,
          acceptedCount: stats.acceptedCount,
          deduplicatedCount: stats.deduplicatedCount,
          rejectedCount: stats.rejectedCount,
          windowHours: stats.windowHours,
          lastProcessedAt: stats.lastProcessedAt || null,
          source: 'mailbox-inbound-sla-scheduler',
        },
      });
      await this.notificationService.updateMailboxInboundSlaAlertState({
        userId: input.userId,
        status: normalizedStatus,
        alertedAt: new Date(),
      });
      this.logger.warn(
        `mailbox-sla-monitor: emitted ${normalizedStatus} alert for user=${input.userId}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `mailbox-sla-monitor: failed for user=${input.userId}: ${message}`,
      );
    }
  }

  private normalizeStoredStatus(
    status?: string | null,
  ): 'WARNING' | 'CRITICAL' | null {
    const normalizedStatus = String(status || '')
      .trim()
      .toUpperCase();
    if (normalizedStatus === 'CRITICAL') return 'CRITICAL';
    if (normalizedStatus === 'WARNING') return 'WARNING';
    return null;
  }

  private normalizeSlaStatus(status?: string | null): MailboxInboundSlaStatus {
    const normalizedStatus = String(status || '')
      .trim()
      .toUpperCase();
    if (normalizedStatus === 'CRITICAL') return 'CRITICAL';
    if (normalizedStatus === 'WARNING') return 'WARNING';
    if (normalizedStatus === 'HEALTHY') return 'HEALTHY';
    return 'NO_DATA';
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

  private resolveCooldownMinutes(input: {
    fallbackCooldownMinutes: number;
    preferenceCooldownMinutes?: number | null;
  }): number {
    return this.resolvePositiveInteger({
      rawValue:
        input.preferenceCooldownMinutes === null ||
        input.preferenceCooldownMinutes === undefined
          ? String(input.fallbackCooldownMinutes)
          : String(input.preferenceCooldownMinutes),
      fallbackValue: input.fallbackCooldownMinutes,
      minimumValue: 1,
      maximumValue: 24 * 60,
    });
  }
}
