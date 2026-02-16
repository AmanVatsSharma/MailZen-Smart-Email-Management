import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

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
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'billing_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      return;
    }

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'billing_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result = await this.billingService.purgeExpiredBillingData({});
      this.logger.log(
        serializeStructuredLog({
          event: 'billing_retention_autopurge_completed',
          runCorrelationId,
          webhookEventsDeleted: result.webhookEventsDeleted,
          aiUsageRowsDeleted: result.aiUsageRowsDeleted,
          webhookRetentionDays: result.webhookRetentionDays,
          aiUsageRetentionMonths: result.aiUsageRetentionMonths,
          executedAtIso: result.executedAtIso,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown purge error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'billing_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
