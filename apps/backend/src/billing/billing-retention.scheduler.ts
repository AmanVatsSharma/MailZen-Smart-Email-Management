import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class BillingRetentionScheduler {
  private readonly logger = new Logger(BillingRetentionScheduler.name);

  constructor(private readonly billingService: BillingService) {}

  private isEnabled(): boolean {
    const value = String(
      process.env.BILLING_RETENTION_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'no', 'off'].includes(value);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredBillingData(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.log('billing-retention: auto-purge disabled by env');
      return;
    }

    try {
      const result = await this.billingService.purgeExpiredBillingData({});
      this.logger.log(
        `billing-retention: purged webhookEvents=${result.webhookEventsDeleted} aiUsageRows=${result.aiUsageRowsDeleted} webhookDays=${result.webhookRetentionDays} usageMonths=${result.aiUsageRetentionMonths}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown purge error';
      this.logger.warn(`billing-retention: purge failed: ${message}`);
    }
  }
}
