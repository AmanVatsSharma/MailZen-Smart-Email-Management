/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-subscription.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing ISubscriptionRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ISubscriptionRepository } from '../../../application/ports/repositories/subscription.repository';
import { Subscription } from '../../../../domain/bounded-contexts/billing/subscription.aggregate';
import { Result } from '../../../../domain/shared/result';
import { SubscriptionId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { SubscriptionOrmEntity } from '../entities/subscription.orm-entity';

@Injectable()
export class TypeOrmSubscriptionRepository implements ISubscriptionRepository {
  constructor(
    @InjectRepository(SubscriptionOrmEntity)
    private readonly repo: Repository<SubscriptionOrmEntity>,
  ) {}

  async save(subscription: Subscription): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(subscription);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: SubscriptionId): Promise<Subscription | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async findActiveForWorkspace(workspaceId: WorkspaceId): Promise<Subscription | null> {
    const row = await this.repo.findOne({
      where: { workspaceId: workspaceId.value, status: 'active' },
    });
    return row ? this.toDomain(row) : null;
  }

  private toOrm(sub: Subscription): SubscriptionOrmEntity {
    const orm = new SubscriptionOrmEntity();
    orm.id = sub.id.value;
    orm.workspaceId = sub.props.workspaceId.value;
    orm.planId = sub.props.planId.value;
    orm.status = sub.props.status;
    orm.currentPeriodStart = sub.props.currentPeriodStart;
    orm.currentPeriodEnd = sub.props.currentPeriodEnd;
    orm.cancelAtPeriodEnd = sub.props.cancelAtPeriodEnd;
    return orm;
  }

  private toDomain(row: SubscriptionOrmEntity): Subscription {
    return Subscription.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      planId: row.planId,
      status: row.status as never,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
