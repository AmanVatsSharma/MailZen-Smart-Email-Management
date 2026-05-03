/**
 * File:        apps/backend/src/automation/automation-migration-from-filter.service.ts
 * Module:      Automation Engine · Filter Migration
 * Purpose:     One-time migration service that converts legacy EmailFilter rows into
 *              Automation + AutomationVersion pairs with status DISABLED.
 *              Imported automations are never auto-enabled — each must be explicitly
 *              reviewed and enabled by the workspace admin.
 *
 * Exports:
 *   - AutomationMigrationFromFilterService  — Injectable NestJS service
 *   - MigrationResult                       — summary shape returned by migrateAll()
 *
 * Depends on:
 *   - EmailFilter    — source entity
 *   - Automation     — destination entity (status = DISABLED)
 *   - AutomationVersion — immutable version snapshot
 *
 * Side-effects:
 *   - DB writes (automations + automation_versions rows)
 *   - Idempotent: skips filters that already have a corresponding automation by
 *     checking for sourceFilterId in the automation.description field
 *
 * Key invariants:
 *   - All migrated automations enter as DISABLED (Architecture Invariant #2)
 *   - FORWARD_TO filter actions are intentionally dropped — auto-forward is a
 *     data-exfiltration vector that must never execute silently
 *   - MARK_READ action has no v1 step; migrated as a no-op step comment
 *   - description includes "[migrated:{{filterId}}]" token for idempotency checks
 *
 * Read order:
 *   1. mapConditionOp        — FilterCondition → ConditionOp
 *   2. mapFilterRulesToSteps — FilterAction → AutomationStep[]
 *   3. migrateFilter         — one EmailFilter → one Automation + Version
 *   4. migrateAll            — migrate all filters in workspace or globally
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailFilter } from '../email/entities/email-filter.entity';
import { FilterCondition, FilterAction, EmailFilterRule } from '../email/dto/email-filter.input';
import { Automation, AutomationStatus } from './entities/automation.entity';
import { AutomationVersion } from './entities/automation-version.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

export type MigrationResult = {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ filterId: string; error: string }>;
};

const MIGRATED_TAG = (filterId: string) => `[migrated:${filterId}]`;

function mapConditionOp(condition: FilterCondition): string {
  switch (condition) {
    case FilterCondition.CONTAINS:    return 'contains';
    case FilterCondition.EQUALS:      return 'equals';
    case FilterCondition.STARTS_WITH: return 'starts_with';
    case FilterCondition.ENDS_WITH:   return 'ends_with';
    default:                          return 'contains';
  }
}

function mapFilterRulesToSteps(rules: EmailFilterRule[]): Array<Record<string, unknown>> {
  const steps: Array<Record<string, unknown>> = [];

  for (const rule of rules) {
    switch (rule.action) {
      case FilterAction.APPLY_LABEL:
        if (rule.actionValue) {
          steps.push({
            type: 'email.label.add',
            labelName: rule.actionValue,
            createIfMissing: true,
          });
        }
        break;

      case FilterAction.MARK_IMPORTANT:
        steps.push({
          type: 'email.label.add',
          labelName: 'IMPORTANT',
          createIfMissing: false,
        });
        break;

      case FilterAction.MOVE_TO_FOLDER:
        // Best approximation for v1: archive + label the thread
        steps.push({ type: 'email.archive' });
        if (rule.actionValue) {
          steps.push({
            type: 'email.label.add',
            labelName: rule.actionValue,
            createIfMissing: true,
          });
        }
        break;

      case FilterAction.MARK_READ:
        // No v1 step for mark-read; intentionally dropped
        break;

      case FilterAction.FORWARD_TO:
        // INTENTIONALLY DROPPED — auto-forward is a data-exfiltration vector.
        // The user must re-create this action manually after review.
        break;

      default:
        break;
    }
  }

  return steps;
}

function mapFilterRulesToConditions(rules: EmailFilterRule[]): Record<string, unknown> | null {
  const leafNodes = rules
    .filter((r) => ['subject', 'from', 'to'].includes(r.field))
    .map((r) => ({
      field: r.field,
      op: mapConditionOp(r.condition),
      value: r.value,
    }));

  if (!leafNodes.length) return null;
  if (leafNodes.length === 1) return leafNodes[0];
  return { all: leafNodes };
}

@Injectable()
export class AutomationMigrationFromFilterService {
  private readonly logger = new Logger(AutomationMigrationFromFilterService.name);

  constructor(
    @InjectRepository(EmailFilter)
    private readonly filterRepo: Repository<EmailFilter>,
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(AutomationVersion)
    private readonly versionRepo: Repository<AutomationVersion>,
  ) {}

  async migrateAll(input: {
    userId?: string;
    workspaceId?: string;
    dryRun?: boolean;
  }): Promise<MigrationResult> {
    const where: Record<string, unknown> = {};
    if (input.userId) where['userId'] = input.userId;

    const filters = await this.filterRepo.find({ where });

    const result: MigrationResult = {
      total: filters.length,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const filter of filters) {
      try {
        const alreadyMigrated = await this.automationRepo.findOne({
          where: {},
        }).then(async () => {
          // Check idempotency via description tag
          const existing = await this.automationRepo
            .createQueryBuilder('a')
            .where('a.description LIKE :tag', { tag: `%${MIGRATED_TAG(filter.id)}%` })
            .getOne();
          return existing != null;
        });

        if (alreadyMigrated) {
          result.skipped += 1;
          continue;
        }

        if (!input.dryRun) {
          await this.migrateFilter(filter, input.workspaceId);
        }
        result.migrated += 1;
      } catch (err: unknown) {
        result.failed += 1;
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push({ filterId: filter.id, error: errorMsg });
        this.logger.warn(
          serializeStructuredLog({
            event: 'automation_migration_filter_failed',
            filterId: filter.id,
            error: errorMsg,
          }),
        );
      }
    }

    this.logger.log(
      serializeStructuredLog({
        event: 'automation_migration_complete',
        total: result.total,
        migrated: result.migrated,
        skipped: result.skipped,
        failed: result.failed,
        dryRun: input.dryRun ?? false,
      }),
    );

    return result;
  }

  private async migrateFilter(
    filter: EmailFilter,
    workspaceId?: string,
  ): Promise<Automation> {
    const rules: EmailFilterRule[] = Array.isArray(filter.rules)
      ? (filter.rules as EmailFilterRule[])
      : [];

    const trigger = { type: 'email.received' };
    const conditions = mapFilterRulesToConditions(rules);
    const steps = mapFilterRulesToSteps(rules);

    // Ensure at least one step exists (no-op label if all actions were dropped)
    const finalSteps = steps.length > 0 ? steps : [{ type: 'email.label.add', labelName: 'migrated', createIfMissing: true }];

    const automation = await this.automationRepo.save(
      this.automationRepo.create({
        workspaceId: workspaceId ?? '',
        name: filter.name,
        description: `Migrated from email filter. ${MIGRATED_TAG(filter.id)}`,
        status: AutomationStatus.DISABLED,
        createdByUserId: filter.userId,
      }),
    );

    const version = await this.versionRepo.save(
      this.versionRepo.create({
        automationId: automation.id,
        version: 1,
        trigger,
        conditions,
        steps: finalSteps,
        publishedAt: new Date(),
        publishedByUserId: filter.userId,
      }),
    );

    await this.automationRepo.update(automation.id, { currentVersionId: version.id });
    return { ...automation, currentVersionId: version.id };
  }
}
