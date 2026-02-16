import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SmartReplyService } from './smart-reply.service';

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
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log('smart-reply-history: auto-purge disabled by env');
      return;
    }

    try {
      const result = await this.smartReplyService.purgeHistoryByRetentionPolicy(
        {},
      );
      this.logger.log(
        `smart-reply-history: purged rows=${result.deletedRows} retentionDays=${result.retentionDays}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`smart-reply-history: purge failed: ${message}`);
    }
  }
}
