import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailboxSyncService } from './mailbox-sync.service';

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
    if (!this.isMailboxSyncEnabled()) {
      this.logger.log('mailbox-sync: scheduler disabled by env');
      return;
    }

    try {
      const summary = await this.mailboxSyncService.pollActiveMailboxes();
      this.logger.log(
        `mailbox-sync: polled=${summary.polledMailboxes} failed=${summary.failedMailboxes} fetched=${summary.fetchedMessages} accepted=${summary.acceptedMessages} deduplicated=${summary.deduplicatedMessages} rejected=${summary.rejectedMessages}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`mailbox-sync: scheduler failed: ${message}`);
    }
  }
}
