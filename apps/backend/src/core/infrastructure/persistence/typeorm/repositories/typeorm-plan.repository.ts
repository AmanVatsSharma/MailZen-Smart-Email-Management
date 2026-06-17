/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-plan.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IPlanRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPlanRepository } from '../../../../application/ports/repositories/plan.repository';
import { Plan } from '../../../../domain/bounded-contexts/billing/plan.aggregate';
import { Result } from '../../../../domain/shared/result';
import { PlanId } from '../../../../domain/shared/value-objects/ids';
import { PlanOrmEntity } from '../entities/plan.orm-entity';

@Injectable()
export class TypeOrmPlanRepository implements IPlanRepository {
  constructor(
    @InjectRepository(PlanOrmEntity)
    private readonly repo: Repository<PlanOrmEntity>,
  ) {}

  async save(plan: Plan): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(plan);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: PlanId): Promise<Plan | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Plan | null> {
    const row = await this.repo.findOne({ where: { slug } });
    return row ? this.toDomain(row) : null;
  }

  async listActive(): Promise<Plan[]> {
    const rows = await this.repo.find({ where: { active: true }, order: { sortOrder: 'ASC' } });
    return rows.map(r => this.toDomain(r));
  }

  private toOrm(plan: Plan): PlanOrmEntity {
    const orm = new PlanOrmEntity();
    orm.id = plan.id.value;
    orm.slug = plan.props.slug;
    orm.name = plan.props.name;
    orm.description = plan.props.description;
    orm.priceCents = plan.props.priceCents;
    orm.currency = plan.props.currency;
    orm.interval = plan.props.interval;
    orm.aiCreditsPerMonth = plan.props.aiCreditsPerMonth;
    orm.features = plan.props.features;
    orm.active = plan.props.active;
    orm.sortOrder = plan.props.sortOrder;
    return orm;
  }

  private toDomain(row: PlanOrmEntity): Plan {
    return Plan.reconstitute({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      priceCents: row.priceCents,
      currency: row.currency,
      interval: row.interval as never,
      aiCreditsPerMonth: row.aiCreditsPerMonth,
      features: row.features,
      active: row.active,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
    });
  }
}
