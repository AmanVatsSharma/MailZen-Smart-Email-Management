import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailboxService } from './mailbox.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

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
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_inbound_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      return;
    }

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_inbound_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result = await this.mailboxService.purgeInboundEventRetentionData(
        {},
      );
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_inbound_retention_autopurge_completed',
          runCorrelationId,
          deletedEvents: result.deletedEvents,
          retentionDays: result.retentionDays,
          executedAtIso: result.executedAtIso,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_inbound_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
