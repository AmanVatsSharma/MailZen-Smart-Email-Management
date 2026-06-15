/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-triage.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing ITriageResultRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ITriageResultRepository } from '../../../application/ports/repositories/triage.repository';
import { TriageResult } from '../../../../domain/bounded-contexts/ai/triage-result.aggregate';
import { Result } from '../../../../domain/shared/result';
import { TriageResultOrmEntity } from '../entities/triage-result.orm-entity';

@Injectable()
export class TypeOrmTriageResultRepository implements ITriageResultRepository {
  constructor(
    @InjectRepository(TriageResultOrmEntity)
    private readonly repo: Repository<TriageResultOrmEntity>,
  ) {}

  async save(result: TriageResult): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(result);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findByEmailId(emailId: string): Promise<TriageResult | null> {
    const row = await this.repo.findOne({ where: { emailId } });
    return row ? this.toDomain(row) : null;
  }

  async listByCategory(
    userId: string,
    category: string,
    limit: number,
    offset: number,
  ): Promise<{ items: TriageResult[]; total: number }> {
    const [rows, total] = await this.repo.findAndCount({
      where: { userId, category },
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
    return { items: rows.map(r => this.toDomain(r)), total };
  }

  private toOrm(t: TriageResult): TriageResultOrmEntity {
    const orm = new TriageResultOrmEntity();
    orm.id = t.props.id;
    orm.emailId = t.props.emailId;
    orm.userId = t.props.userId;
    orm.category = t.props.category;
    orm.priority = t.props.priority;
    orm.confidence = t.props.confidence;
    orm.reasoning = t.props.reasoning;
    return orm;
  }

  private toDomain(row: TriageResultOrmEntity): TriageResult {
    return TriageResult.reconstitute({
      id: row.id,
      emailId: row.emailId,
      userId: row.userId,
      category: row.category as never,
      priority: row.priority as never,
      confidence: row.confidence,
      reasoning: row.reasoning,
      createdAt: row.createdAt,
    });
  }
}
