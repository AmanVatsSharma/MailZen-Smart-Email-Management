/**
 * File:        apps/backend/src/automation/automation-run-retention.scheduler.ts
 * Module:      Automation Engine · Retention
 * Purpose:     Daily cron job that deletes terminal automation_runs (and their
 *              step rows via cascade) older than AUTOMATION_RUN_RETENTION_DAYS
 *              (default 90). Mirrors the ai-agent-action-audit-retention pattern.
 *
 * Exports:
 *   - AutomationRunRetentionScheduler  — Injectable NestJS service with @Cron
 *
 * Depends on:
 *   - AutomationRun repository   — queries rows to delete
 *   - AutomationStepRun          — deleted via cascade or explicit delete
 *   - AuditLog repository        — records purge events
 *
 * Side-effects:
 *   - DB deletes terminal automation_runs + cascade step_runs older than retention window
 *
 * Key invariants:
 *   - Only terminal statuses are purged (SUCCEEDED, FAILED, CANCELED, SKIPPED_CONDITIONS)
 *   - QUEUED/RUNNING rows are never deleted — active runs are protected
 *   - Disabled via env AUTOMATION_RUN_RETENTION_AUTOPURGE_ENABLED=false
 *   - Runs at 4 AM daily (offset from ai-agent scheduler at 3 AM to avoid contention)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { AutomationRun, AutomationRunStatus } from './entities/automation-run.entity';
import { AutomationStepRun } from './entities/automation-step-run.entity';
import { AuditLog } from '../auth/entities/audit-log.entity';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

const TERMINAL_STATUSES = [
  AutomationRunStatus.SUCCEEDED,
  AutomationRunStatus.FAILED,
  AutomationRunStatus.CANCELED,
  AutomationRunStatus.SKIPPED_CONDITIONS,
];

const SYSTEM_ACTOR = 'system:automation-run-retention-scheduler';

@Injectable()
export class AutomationRunRetentionScheduler {
  private readonly logger = new Logger(AutomationRunRetentionScheduler.name);
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(AutomationRun)
    private readonly runRepo: Repository<AutomationRun>,
    @InjectRepository(AutomationStepRun)
    private readonly stepRunRepo: Repository<AutomationStepRun>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {
    this.retentionDays = parseInt(
      process.env.AUTOMATION_RUN_RETENTION_DAYS ?? '90',
      10,
    );
  }

  @Cron('0 4 * * *') // 4 AM daily, offset from ai-agent retention at 3 AM
  async purgeExpiredRuns(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.log(
        serializeStructuredLog({ event: 'automation_run_retention_disabled' }),
      );
      return;
    }

    const correlationId = resolveCorrelationId(undefined);
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

    this.logger.log(
      serializeStructuredLog({
        event: 'automation_run_retention_started',
        cutoff: cutoff.toISOString(),
        retentionDays: this.retentionDays,
        correlationId,
      }),
    );

    try {
      // Find run IDs to delete first (to cascade step rows explicitly when needed)
      const runsToDelete = await this.runRepo.find({
        where: {
          status: In(TERMINAL_STATUSES),
          createdAt: LessThan(cutoff),
        },
        select: ['id'],
      });

      if (!runsToDelete.length) {
        this.logger.log(
          serializeStructuredLog({
            event: 'automation_run_retention_nothing_to_purge',
            correlationId,
          }),
        );
        return;
      }

      const runIds = runsToDelete.map((r) => r.id);

      // Delete step rows first to avoid FK constraint issues if cascade is not configured
      await this.stepRunRepo.delete({ runId: In(runIds) });
      const deleteResult = await this.runRepo.delete({ id: In(runIds) });
      const deleted = deleteResult.affected ?? runIds.length;

      this.logger.log(
        serializeStructuredLog({
          event: 'automation_run_retention_completed',
          deleted,
          retentionDays: this.retentionDays,
          cutoff: cutoff.toISOString(),
          correlationId,
        }),
      );

      await this.writeAuditLog({
        action: 'automation_runs_purged',
        metadata: { deleted, cutoff: cutoff.toISOString(), retentionDays: this.retentionDays, correlationId },
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        serializeStructuredLog({
          event: 'automation_run_retention_failed',
          error,
          correlationId,
        }),
      );

      await this.writeAuditLog({
        action: 'automation_runs_purge_failed',
        metadata: { error, correlationId },
      });
    }
  }

  private isEnabled(): boolean {
    const val = String(
      process.env.AUTOMATION_RUN_RETENTION_AUTOPURGE_ENABLED ?? 'true',
    ).trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(val);
  }

  private async writeAuditLog(input: {
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditLogRepo.save(
        this.auditLogRepo.create({ userId: SYSTEM_ACTOR, action: input.action, metadata: input.metadata }),
      );
    } catch {
      // Audit log failure is non-fatal
    }
  }
}
