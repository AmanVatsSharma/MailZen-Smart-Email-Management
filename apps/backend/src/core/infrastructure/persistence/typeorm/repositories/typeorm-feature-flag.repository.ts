/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-feature-flag.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter for FeatureFlag repository.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { IFeatureFlagRepository } from '../../../../application/ports/repositories/feature-flag.repository';
import { FeatureFlag } from '../../../../domain/bounded-contexts/feature/feature-flag.aggregate';
import { Result } from '../../../../domain/shared/result';
import { FeatureFlagOrmEntity } from '../entities/feature-flag.orm-entity';

@Injectable()
export class TypeOrmFeatureFlagRepository implements IFeatureFlagRepository {
  constructor(
    @InjectRepository(FeatureFlagOrmEntity)
    private readonly repo: Repository<FeatureFlagOrmEntity>,
  ) {}

  async save(flag: FeatureFlag): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(flag);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findByKey(key: string, workspaceId: string | null): Promise<FeatureFlag | null> {
    const row = workspaceId
      ? await this.repo.findOne({ where: { key, workspaceId } })
      : await this.repo.findOne({ where: { key, workspaceId: IsNull() } });
    return row ? this.toDomain(row) : null;
  }

  async listAll(): Promise<FeatureFlag[]> {
    const rows = await this.repo.find();
    return rows.map(r => this.toDomain(r));
  }

  private toOrm(f: FeatureFlag): FeatureFlagOrmEntity {
    const orm = new FeatureFlagOrmEntity();
    orm.key = f.key;
    orm.workspaceId = f.props.workspaceId;
    orm.enabled = f.props.enabled;
    orm.rolloutPercent = f.props.rolloutPercent;
    return orm;
  }

  private toDomain(row: FeatureFlagOrmEntity): FeatureFlag {
    return FeatureFlag.reconstitute({
      key: row.key,
      workspaceId: row.workspaceId,
      enabled: row.enabled,
      rolloutPercent: row.rolloutPercent,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
