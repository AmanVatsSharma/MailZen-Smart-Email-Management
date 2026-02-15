import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './notification.service';

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
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log('notification-retention: auto-purge disabled by env');
      return;
    }

    try {
      const result =
        await this.notificationService.purgeNotificationRetentionData({});
      this.logger.log(
        `notification-retention: purged notifications=${result.notificationsDeleted} pushSubscriptions=${result.pushSubscriptionsDeleted} notificationDays=${result.notificationRetentionDays} disabledPushDays=${result.disabledPushRetentionDays}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`notification-retention: purge failed: ${message}`);
    }
  }
}
