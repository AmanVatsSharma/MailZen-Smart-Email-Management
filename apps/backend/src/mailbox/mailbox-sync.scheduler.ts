import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailboxSyncService } from './mailbox-sync.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class MailboxSyncScheduler {
  private readonly logger = new Logger(MailboxSyncScheduler.name);

  constructor(private readonly mailboxSyncService: MailboxSyncService) {}

  private isMailboxSyncEnabled(): boolean {
    const normalized = String(
      process.env.MAILZEN_MAILBOX_SYNC_ENABLED || 'false',
    )
      .trim()
      .toLowerCase();
    return ['1', 'true', 'on', 'yes'].includes(normalized);
  }

  @Cron('*/10 * * * *')
  async syncMailboxes() {
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isMailboxSyncEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_scheduler_disabled',
          runCorrelationId,
        }),
      );
      return;
    }

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_scheduler_start',
          runCorrelationId,
        }),
      );
      const summary = await this.mailboxSyncService.pollActiveMailboxes();
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_scheduler_completed',
          runCorrelationId,
          polledMailboxes: summary.polledMailboxes,
          skippedMailboxes: summary.skippedMailboxes,
          failedMailboxes: summary.failedMailboxes,
          fetchedMessages: summary.fetchedMessages,
          acceptedMessages: summary.acceptedMessages,
          deduplicatedMessages: summary.deduplicatedMessages,
          rejectedMessages: summary.rejectedMessages,
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_scheduler_failed',
          runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
