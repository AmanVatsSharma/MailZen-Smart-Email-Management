import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailboxSyncService } from './mailbox-sync.service';

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
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log('mailbox-sync-retention: auto-purge disabled by env');
      return;
    }

    try {
      const result =
        await this.mailboxSyncService.purgeMailboxSyncRunRetentionData({});
      this.logger.log(
        `mailbox-sync-retention: purgedRuns=${result.deletedRuns} retentionDays=${result.retentionDays}`,
      );
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`mailbox-sync-retention: auto-purge failed: ${reason}`);
    }
  }
}
