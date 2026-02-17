import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { BillingService } from './billing.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class BillingRetentionScheduler {
  private static readonly RETENTION_AUTOPURGE_ACTOR_USER_ID =
    'system:billing-retention-scheduler';
  private readonly logger = new Logger(BillingRetentionScheduler.name);

  constructor(
    private readonly billingService: BillingService,
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
          event: 'billing_retention_scheduler_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private isEnabled(): boolean {
    const value = String(
      process.env.BILLING_RETENTION_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'no', 'off'].includes(value);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredBillingData(): Promise<void> {
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'billing_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      await this.writeAuditLog({
        userId: BillingRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'billing_retention_autopurge_skipped',
        metadata: {
          runCorrelationId,
          reason: 'autopurge_disabled_by_env',
        },
      });
      return;
    }

    await this.writeAuditLog({
      userId: BillingRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
      action: 'billing_retention_autopurge_started',
      metadata: {
        runCorrelationId,
      },
    });

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'billing_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result = await this.billingService.purgeExpiredBillingData({
        actorUserId: BillingRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
      });
      this.logger.log(
        serializeStructuredLog({
          event: 'billing_retention_autopurge_completed',
          runCorrelationId,
          webhookEventsDeleted: result.webhookEventsDeleted,
          aiUsageRowsDeleted: result.aiUsageRowsDeleted,
          webhookRetentionDays: result.webhookRetentionDays,
          aiUsageRetentionMonths: result.aiUsageRetentionMonths,
          executedAtIso: result.executedAtIso,
        }),
      );
      await this.writeAuditLog({
        userId: BillingRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'billing_retention_autopurge_completed',
        metadata: {
          runCorrelationId,
          webhookEventsDeleted: result.webhookEventsDeleted,
          aiUsageRowsDeleted: result.aiUsageRowsDeleted,
          webhookRetentionDays: result.webhookRetentionDays,
          aiUsageRetentionMonths: result.aiUsageRetentionMonths,
          executedAtIso: result.executedAtIso,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown purge error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'billing_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
      await this.writeAuditLog({
        userId: BillingRetentionScheduler.RETENTION_AUTOPURGE_ACTOR_USER_ID,
        action: 'billing_retention_autopurge_failed',
        metadata: {
          runCorrelationId,
          error: message,
        },
      });
    }
  }
}
