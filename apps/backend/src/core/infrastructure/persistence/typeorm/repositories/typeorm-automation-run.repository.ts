/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-automation-run.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter for AutomationRun (event log of a single execution).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAutomationRunRepository } from '../../../application/ports/repositories/automation-run.repository';
import { Result } from '../../../../domain/shared/result';
import { AutomationRunOrmEntity } from '../entities/automation-run.orm-entity';

@Injectable()
export class TypeOrmAutomationRunRepository implements IAutomationRunRepository {
  constructor(
    @InjectRepository(AutomationRunOrmEntity)
    private readonly repo: Repository<AutomationRunOrmEntity>,
  ) {}

  async save(run: {
    id: string;
    automationVersionId: string;
    triggerEvent: unknown;
    status: string;
    error: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
  }): Promise<Result<void, Error>> {
    try {
      const orm = this.repo.create(run);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async listForAutomation(
    versionId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: unknown[]; total: number }> {
    const [rows, total] = await this.repo.findAndCount({
      where: { automationVersionId: versionId },
      take: limit,
      skip: offset,
      order: { startedAt: 'DESC' },
    });
    return { items: rows, total };
  }
}
