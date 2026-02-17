import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { SmartReplyService } from './smart-reply.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class SmartReplyRetentionScheduler {
  private static readonly RETENTION_AUTOPURGE_ACTOR_USER_ID =
    'system:smart-reply-retention-scheduler';
  private readonly logger = new Logger(SmartReplyRetentionScheduler.name);

  constructor(
    private readonly smartReplyService: SmartReplyService,
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
          event: 'smart_reply_retention_scheduler_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

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
      await this.writeAuditLog({
        userId: SmartReplyRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'smart_reply_retention_autopurge_skipped',
        metadata: {
          runCorrelationId,
          reason: 'autopurge_disabled_by_env',
        },
      });
      return;
    }

    await this.writeAuditLog({
      userId: SmartReplyRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
      action: 'smart_reply_retention_autopurge_started',
      metadata: {
        runCorrelationId,
      },
    });

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
      await this.writeAuditLog({
        userId: SmartReplyRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'smart_reply_retention_autopurge_completed',
        metadata: {
          runCorrelationId,
          deletedRows: result.deletedRows,
          retentionDays: result.retentionDays,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'smart_reply_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
      await this.writeAuditLog({
        userId: SmartReplyRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'smart_reply_retention_autopurge_failed',
        metadata: {
          runCorrelationId,
          error: message,
        },
      });
    }
  }
}
