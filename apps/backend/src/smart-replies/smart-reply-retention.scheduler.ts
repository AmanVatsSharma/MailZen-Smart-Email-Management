import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SmartReplyService } from './smart-reply.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class SmartReplyRetentionScheduler {
  private readonly logger = new Logger(SmartReplyRetentionScheduler.name);

  constructor(private readonly smartReplyService: SmartReplyService) {}

  private isAutoPurgeEnabled(): boolean {
    const normalized = String(
      process.env.MAILZEN_SMART_REPLY_HISTORY_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeSmartReplyHistory(): Promise<void> {
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'smart_reply_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      return;
    }

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'smart_reply_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result = await this.smartReplyService.purgeHistoryByRetentionPolicy(
        {},
      );
      this.logger.log(
        serializeStructuredLog({
          event: 'smart_reply_retention_autopurge_completed',
          runCorrelationId,
          deletedRows: result.deletedRows,
          retentionDays: result.retentionDays,
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'smart_reply_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
