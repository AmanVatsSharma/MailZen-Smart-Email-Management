/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-automation.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IAutomationRepository with TypeORM.
 *              Note: AutomationVersion is immutable - new version rows are created on update.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAutomationRepository } from '../../../application/ports/repositories/automation.repository';
import { Automation } from '../../../../domain/bounded-contexts/automation/automation.aggregate';
import { AutomationStatus } from '../../../../domain/bounded-contexts/automation/value-objects/automation-status.vo';
import { AutomationCondition } from '../../../../domain/bounded-contexts/automation/value-objects/automation-condition.vo';
import { AutomationStep } from '../../../../domain/bounded-contexts/automation/value-objects/automation-step.vo';
import { AutomationTrigger } from '../../../../domain/bounded-contexts/automation/value-objects/automation-trigger.vo';
import { Result } from '../../../../domain/shared/result';
import { AutomationOrmEntity } from '../entities/automation.orm-entity';

@Injectable()
export class TypeOrmAutomationRepository implements IAutomationRepository {
  constructor(
    @InjectRepository(AutomationOrmEntity)
    private readonly repo: Repository<AutomationOrmEntity>,
  ) {}

  async save(automation: Automation): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(automation);
      // Insert new version row - never mutate the published version
      await this.repo.insert(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findByVersionId(versionId: string): Promise<Automation | null> {
    const row = await this.repo.findOne({ where: { id: versionId } });
    return row ? this.toDomain(row) : null;
  }

  async listForWorkspace(workspaceId: string): Promise<Automation[]> {
    const rows = await this.repo.find({
      where: { workspaceId },
      order: { version: 'DESC' },
    });
    return rows.map(r => this.toDomain(r));
  }

  async findPublishedByWorkflowId(workflowId: string): Promise<Automation | null> {
    const row = await this.repo.findOne({
      where: { workflowId, status: 'published' },
      order: { version: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  private toOrm(a: Automation): AutomationOrmEntity {
    const orm = new AutomationOrmEntity();
    orm.id = a.versionId;
    orm.workspaceId = a.workspaceId;
    // ORM row uses `actions` to match the existing column; domain calls them `steps`
    orm.name = a.name;
    orm.trigger = a.trigger as unknown as Record<string, unknown>;
    orm.conditions = a.conditions.map(c => ({ field: c.field, op: c.op, value: c.value }));
    orm.actions = a.steps.map(s => ({ order: s.order, kind: s.kind, config: s.config }));
    orm.status = a.status.toString();
    orm.publishedAt = a.publishedAt;
    return orm;
  }

  private toDomain(row: AutomationOrmEntity): Automation {
    return Automation.reconstitute({
      versionId: row.id,
      workflowId: '',
      workspaceId: row.workspaceId,
      version: row.version,
      name: row.name,
      trigger: AutomationTrigger.create(
        (row.trigger as { type: string })?.type ?? 'unknown',
        (row.trigger as { filter: Record<string, unknown> })?.filter ?? {},
      ),
      conditions: (row.conditions as Array<{ field: string; op: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'exists' | 'in'; value: unknown }> ?? [])
        .map(c => AutomationCondition.create(c.field, c.op, c.value)),
      steps: (row.actions as Array<{ order: number; kind: 'send_email' | 'add_label' | 'remove_label' | 'mark_read' | 'archive' | 'notify' | 'webhook'; config: Record<string, unknown> }> ?? [])
        .map(s => AutomationStep.create(s.order, s.kind, s.config)),
      status: AutomationStatus.from(row.status),
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
    });
  }
}
