import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailboxService } from './mailbox.service';

@Injectable()
export class MailboxInboundRetentionScheduler {
  private readonly logger = new Logger(MailboxInboundRetentionScheduler.name);

  constructor(private readonly mailboxService: MailboxService) {}

  private isAutoPurgeEnabled(): boolean {
    const normalized = String(
      process.env.MAILZEN_MAILBOX_INBOUND_RETENTION_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeMailboxInboundRetentionData(): Promise<void> {
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log('mailbox-retention: auto-purge disabled by env');
      return;
    }

    try {
      const result = await this.mailboxService.purgeInboundEventRetentionData(
        {},
      );
      this.logger.log(
        `mailbox-retention: purgedEvents=${result.deletedEvents} retentionDays=${result.retentionDays}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`mailbox-retention: purge failed: ${message}`);
    }
  }
}
