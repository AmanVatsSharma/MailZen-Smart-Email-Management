import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { MailboxSyncService } from './mailbox-sync.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class MailboxSyncRunRetentionScheduler {
  private static readonly RETENTION_AUTOPURGE_ACTOR_USER_ID =
    'system:mailbox-sync-run-retention-scheduler';
  private readonly logger = new Logger(MailboxSyncRunRetentionScheduler.name);

  constructor(
    private readonly mailboxSyncService: MailboxSyncService,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepo.create({
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
      });
      await this.auditLogRepo.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_run_retention_scheduler_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

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
      await this.writeAuditLog({
        userId:
          MailboxSyncRunRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'mailbox_sync_run_retention_autopurge_skipped',
        metadata: {
          runCorrelationId,
          reason: 'autopurge_disabled_by_env',
        },
      });
      return;
    }

    await this.writeAuditLog({
      userId: MailboxSyncRunRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
      action: 'mailbox_sync_run_retention_autopurge_started',
      metadata: {
        runCorrelationId,
      },
    });

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_run_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result =
        await this.mailboxSyncService.purgeMailboxSyncRunRetentionData({
          userId:
            MailboxSyncRunRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        });
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_run_retention_autopurge_completed',
          runCorrelationId,
          deletedRuns: result.deletedRuns,
          retentionDays: result.retentionDays,
          executedAtIso: result.executedAtIso,
        }),
      );
      await this.writeAuditLog({
        userId:
          MailboxSyncRunRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'mailbox_sync_run_retention_autopurge_completed',
        metadata: {
          runCorrelationId,
          deletedRuns: result.deletedRuns,
          retentionDays: result.retentionDays,
          executedAtIso: result.executedAtIso,
        },
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_run_retention_autopurge_failed',
          runCorrelationId,
          error: reason,
        }),
      );
      await this.writeAuditLog({
        userId:
          MailboxSyncRunRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'mailbox_sync_run_retention_autopurge_failed',
        metadata: {
          runCorrelationId,
          error: reason,
        },
      });
    }
  }
}
