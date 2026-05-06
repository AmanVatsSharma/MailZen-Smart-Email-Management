/**
 * File:        apps/backend/src/automation/automation.service.ts
 * Module:      Automation Engine · Service
 * Purpose:     Business logic for automation CRUD, version management, run queries,
 *              and lifecycle mutations (enable/disable/archive/manual-run/retry/cancel).
 *
 * Exports:
 *   - AutomationService  — Injectable NestJS service
 *
 * Depends on:
 *   - Automation, AutomationVersion, AutomationRun repositories (TypeORM)
 *   - AutomationEventBus  — for runAutomationManually
 *   - AuditLog repository — every state-changing write logs an AuditLog row
 *   - BillingService      — plan entitlement gate on createAutomation + enableAutomation
 *
 * Side-effects:
 *   - DB reads/writes on automation tables
 *   - AutomationEventBus.publish() for manual runs
 *   - AuditLog row on every mutation
 *
 * Key invariants:
 *   - AutomationVersion rows are immutable; updateAutomation creates a new version row
 *   - workspaceId is enforced on every query — no cross-tenant reads
 *   - Migrated EmailFilter automations enter as DISABLED (never auto-enabled here)
 *   - Cursor = base64(createdAt.toISOString()) — decode to apply WHERE createdAt < cursor
 *
 * Read order:
 *   1. Query methods (listAutomations, getAutomation, listRuns, getRun)
 *   2. Mutation methods (create, update, enable, disable, archive, manualRun, retry, cancel)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, FindOptionsWhere } from 'typeorm';
import { Automation, AutomationStatus } from './entities/automation.entity';
import { AutomationVersion } from './entities/automation-version.entity';
import { AutomationRun, AutomationRunStatus } from './entities/automation-run.entity';
import { AutomationStepRun } from './entities/automation-step-run.entity';
import { AutomationEventBus } from './automation-event.bus';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { AutomationConnection, AutomationRunConnection } from './dto/automation.connection';
import { serializeStructuredLog, resolveCorrelationId } from '../common/logging/structured-log.util';
import { BillingService } from '../billing/billing.service';

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64');
}

function decodeCursor(cursor: string): Date {
  return new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(AutomationVersion)
    private readonly versionRepo: Repository<AutomationVersion>,
    @InjectRepository(AutomationRun)
    private readonly runRepo: Repository<AutomationRun>,
    @InjectRepository(AutomationStepRun)
    private readonly stepRunRepo: Repository<AutomationStepRun>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly eventBus: AutomationEventBus,
    private readonly billingService: BillingService,
  ) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async listAutomations(input: {
    workspaceId: string;
    status?: AutomationStatus;
    ownerUserId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<AutomationConnection> {
    const limit = Math.min(input.limit ?? 50, 100);
    const where: Record<string, unknown> = { workspaceId: input.workspaceId };
    if (input.status) where['status'] = input.status;
    if (input.ownerUserId) where['ownerUserId'] = input.ownerUserId;
    if (input.cursor) where['createdAt'] = LessThan(decodeCursor(input.cursor));

    const nodes = await this.automationRepo.find({
      where: where as FindOptionsWhere<Automation>,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (nodes.length > limit) {
      nodes.pop();
      nextCursor = encodeCursor(nodes[nodes.length - 1].createdAt);
    }
    return { nodes, nextCursor };
  }

  async getAutomation(id: string, workspaceId: string): Promise<Automation> {
    const automation = await this.automationRepo.findOne({
      where: { id, workspaceId },
    });
    if (!automation) throw new NotFoundException('Automation not found');
    return automation;
  }

  async getAutomationVersions(automationId: string, workspaceId: string, limit = 10): Promise<AutomationVersion[]> {
    await this.getAutomation(automationId, workspaceId);
    return this.versionRepo.find({
      where: { automationId },
      order: { version: 'DESC' },
      take: limit,
    });
  }

  async listRuns(input: {
    automationId?: string;
    workspaceId?: string;
    status?: AutomationRunStatus;
    since?: Date;
    limit?: number;
    cursor?: string;
  }): Promise<AutomationRunConnection> {
    const limit = Math.min(input.limit ?? 50, 100);
    const where: Record<string, unknown> = {};
    if (input.workspaceId) where['workspaceId'] = input.workspaceId;
    if (input.automationId) where['automationId'] = input.automationId;
    if (input.status) where['status'] = input.status;
    if (input.cursor) where['createdAt'] = LessThan(decodeCursor(input.cursor));

    const nodes = await this.runRepo.find({
      where: where as FindOptionsWhere<AutomationRun>,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (nodes.length > limit) {
      nodes.pop();
      nextCursor = encodeCursor(nodes[nodes.length - 1].createdAt);
    }
    return { nodes, nextCursor };
  }

  async getRun(id: string): Promise<AutomationRun> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException('AutomationRun not found');
    return run;
  }

  async getRunSteps(runId: string): Promise<AutomationStepRun[]> {
    return this.stepRunRepo.find({
      where: { runId },
      order: { stepIndex: 'ASC', attempt: 'ASC' },
    });
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async createAutomation(input: {
    workspaceId: string;
    ownerUserId?: string | null;
    name: string;
    description?: string | null;
    trigger: Record<string, unknown>;
    conditions?: Record<string, unknown> | null;
    steps: Record<string, unknown>[];
    createdByUserId: string;
  }): Promise<Automation> {
    const entitlements = await this.billingService.getEntitlements(input.createdByUserId);
    if (!entitlements.automationsEnabled) {
      throw new ForbiddenException('Automation engine requires a Pro or Business plan');
    }

    const automation = await this.automationRepo.save(
      this.automationRepo.create({
        workspaceId: input.workspaceId,
        ownerUserId: input.ownerUserId,
        name: input.name,
        description: input.description,
        status: AutomationStatus.DRAFT,
        createdByUserId: input.createdByUserId,
      }),
    );

    const version = await this.versionRepo.save(
      this.versionRepo.create({
        automationId: automation.id,
        version: 1,
        trigger: input.trigger,
        conditions: input.conditions,
        steps: input.steps,
        publishedAt: new Date(),
        publishedByUserId: input.createdByUserId,
      }),
    );

    await this.automationRepo.update(automation.id, { currentVersionId: version.id });
    await this.writeAuditLog(input.createdByUserId, 'automation_created', { automationId: automation.id });
    return { ...automation, currentVersionId: version.id };
  }

  async updateAutomation(input: {
    id: string;
    workspaceId: string;
    userId: string;
    name?: string | null;
    description?: string | null;
    trigger?: Record<string, unknown> | null;
    conditions?: Record<string, unknown> | null;
    steps?: Record<string, unknown>[] | null;
  }): Promise<Automation> {
    const automation = await this.getAutomation(input.id, input.workspaceId);
    const nameOrDescChanged = input.name !== undefined || input.description !== undefined;
    const logicChanged = input.trigger !== undefined || input.conditions !== undefined || input.steps !== undefined;

    if (nameOrDescChanged) {
      const patch: Partial<Automation> = {};
      if (input.name !== undefined) patch.name = input.name!;
      if (input.description !== undefined) patch.description = input.description;
      await this.automationRepo.update(automation.id, patch);
      Object.assign(automation, patch);
    }

    if (logicChanged) {
      const currentVersion = automation.currentVersionId
        ? await this.versionRepo.findOne({ where: { id: automation.currentVersionId } })
        : null;

      const maxVersionRow = await this.versionRepo
        .createQueryBuilder('v')
        .select('MAX(v.version)', 'max')
        .where('v.automationId = :id', { id: automation.id })
        .getRawOne<{ max: number }>();

      const nextVersion = (maxVersionRow?.max ?? 0) + 1;

      const newVersion = await this.versionRepo.save(
        this.versionRepo.create({
          automationId: automation.id,
          version: nextVersion,
          trigger: input.trigger ?? (currentVersion?.trigger as Record<string, unknown>) ?? {},
          conditions: input.conditions !== undefined ? input.conditions : currentVersion?.conditions as Record<string, unknown> | null,
          steps: input.steps ?? (currentVersion?.steps as Record<string, unknown>[]) ?? [],
          publishedAt: new Date(),
          publishedByUserId: input.userId,
        }),
      );

      await this.automationRepo.update(automation.id, { currentVersionId: newVersion.id });
      automation.currentVersionId = newVersion.id;
    }

    await this.writeAuditLog(input.userId, 'automation_updated', { automationId: automation.id });
    return this.automationRepo.findOne({ where: { id: automation.id, workspaceId: input.workspaceId } }) as Promise<Automation>;
  }

  async enableAutomation(id: string, workspaceId: string, userId: string): Promise<Automation> {
    const entitlements = await this.billingService.getEntitlements(userId);
    if (!entitlements.automationsEnabled) {
      throw new ForbiddenException('Automation engine requires a Pro or Business plan');
    }

    const automation = await this.getAutomation(id, workspaceId);
    if (automation.status === AutomationStatus.ARCHIVED) {
      throw new ForbiddenException('Cannot enable an archived automation');
    }
    await this.automationRepo.update(id, { status: AutomationStatus.ENABLED });
    await this.writeAuditLog(userId, 'automation_enabled', { automationId: id });
    return { ...automation, status: AutomationStatus.ENABLED };
  }

  async disableAutomation(id: string, workspaceId: string, userId: string): Promise<Automation> {
    const automation = await this.getAutomation(id, workspaceId);
    await this.automationRepo.update(id, { status: AutomationStatus.DISABLED });
    await this.writeAuditLog(userId, 'automation_disabled', { automationId: id });
    return { ...automation, status: AutomationStatus.DISABLED };
  }

  async archiveAutomation(id: string, workspaceId: string, userId: string): Promise<Automation> {
    const automation = await this.getAutomation(id, workspaceId);
    await this.automationRepo.update(id, { status: AutomationStatus.ARCHIVED });
    await this.writeAuditLog(userId, 'automation_archived', { automationId: id });
    return { ...automation, status: AutomationStatus.ARCHIVED };
  }

  async runAutomationManually(
    id: string,
    workspaceId: string,
    userId: string,
    contextOverride?: Record<string, unknown> | null,
  ): Promise<AutomationRun> {
    const automation = await this.getAutomation(id, workspaceId);
    const correlationId = resolveCorrelationId(undefined);

    this.eventBus.publish({
      type: 'manual',
      workspaceId,
      userId,
      automationId: id,
      contextOverride: contextOverride ?? undefined,
      correlationId,
    });

    // Return a synthetic queued run (the dispatcher creates the real one)
    const run = await this.runRepo.save(
      this.runRepo.create({
        automationId: automation.id,
        automationVersionId: automation.currentVersionId ?? '',
        workspaceId,
        status: AutomationRunStatus.QUEUED,
        triggerEvent: { type: 'manual', workspaceId, userId, automationId: id },
        correlationId,
      }),
    );

    this.logger.log(
      serializeStructuredLog({
        event: 'automation_manual_run_initiated',
        automationId: id,
        runId: run.id,
        correlationId,
      }),
    );
    return run;
  }

  async retryAutomationRun(runId: string, userId: string): Promise<AutomationRun> {
    const run = await this.getRun(runId);
    if (run.status !== AutomationRunStatus.FAILED) {
      throw new ForbiddenException('Only FAILED runs can be retried');
    }
    const newRun = await this.runRepo.save(
      this.runRepo.create({
        automationId: run.automationId,
        automationVersionId: run.automationVersionId,
        workspaceId: run.workspaceId,
        status: AutomationRunStatus.QUEUED,
        triggerEvent: run.triggerEvent,
        correlationId: resolveCorrelationId(undefined),
      }),
    );
    await this.writeAuditLog(userId, 'automation_run_retried', { originalRunId: runId, newRunId: newRun.id });
    return newRun;
  }

  async cancelAutomationRun(runId: string, userId: string): Promise<AutomationRun> {
    const run = await this.getRun(runId);
    if ([AutomationRunStatus.SUCCEEDED, AutomationRunStatus.FAILED, AutomationRunStatus.CANCELED].includes(run.status)) {
      throw new ForbiddenException('Run is already in a terminal state');
    }
    await this.runRepo.update(runId, {
      status: AutomationRunStatus.CANCELED,
      finishedAt: new Date(),
    });
    await this.writeAuditLog(userId, 'automation_run_canceled', { runId });
    return { ...run, status: AutomationRunStatus.CANCELED, finishedAt: new Date() };
  }

  private async writeAuditLog(
    userId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditLogRepo.save(this.auditLogRepo.create({ userId, action, metadata }));
    } catch (err: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'automation_audit_log_write_failed',
          userId,
          action,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
