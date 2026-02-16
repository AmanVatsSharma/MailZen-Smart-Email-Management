import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './notification.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class NotificationRetentionScheduler {
  private readonly logger = new Logger(NotificationRetentionScheduler.name);

  constructor(private readonly notificationService: NotificationService) {}

  private isAutoPurgeEnabled(): boolean {
    const normalized = String(
      process.env.MAILZEN_NOTIFICATION_RETENTION_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeRetentionData(): Promise<void> {
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'notification_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      return;
    }

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'notification_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result =
        await this.notificationService.purgeNotificationRetentionData({});
      this.logger.log(
        serializeStructuredLog({
          event: 'notification_retention_autopurge_completed',
          runCorrelationId,
          notificationsDeleted: result.notificationsDeleted,
          pushSubscriptionsDeleted: result.pushSubscriptionsDeleted,
          notificationRetentionDays: result.notificationRetentionDays,
          disabledPushRetentionDays: result.disabledPushRetentionDays,
          executedAtIso: result.executedAtIso,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'notification_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
