import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailboxSyncService } from './mailbox-sync.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class MailboxSyncRunRetentionScheduler {
  private readonly logger = new Logger(MailboxSyncRunRetentionScheduler.name);

  constructor(private readonly mailboxSyncService: MailboxSyncService) {}

  private isAutoPurgeEnabled(): boolean {
    const normalized = String(
      process.env.MAILZEN_MAILBOX_SYNC_RUN_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeMailboxSyncRunRetentionData(): Promise<void> {
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_run_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      return;
    }

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_run_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result =
        await this.mailboxSyncService.purgeMailboxSyncRunRetentionData({});
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_run_retention_autopurge_completed',
          runCorrelationId,
          deletedRuns: result.deletedRuns,
          retentionDays: result.retentionDays,
          executedAtIso: result.executedAtIso,
        }),
      );
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_run_retention_autopurge_failed',
          runCorrelationId,
          error: reason,
        }),
      );
    }
  }
}
