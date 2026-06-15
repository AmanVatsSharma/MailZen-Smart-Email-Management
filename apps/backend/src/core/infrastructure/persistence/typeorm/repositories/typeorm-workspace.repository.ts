/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-workspace.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IWorkspaceRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IWorkspaceRepository } from '../../../application/ports/repositories/workspace.repository';
import { Workspace } from '../../../../domain/bounded-contexts/workspaces/workspace.aggregate';
import { Result } from '../../../../domain/shared/result';
import { WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { WorkspaceOrmEntity } from '../entities/workspace.orm-entity';

@Injectable()
export class TypeOrmWorkspaceRepository implements IWorkspaceRepository {
  constructor(
    @InjectRepository(WorkspaceOrmEntity)
    private readonly repo: Repository<WorkspaceOrmEntity>,
  ) {}

  async save(workspace: Workspace): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(workspace);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: WorkspaceId): Promise<Workspace | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const row = await this.repo.findOne({ where: { slug } });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: { limit: number; offset: number; ownerId?: string }) {
    const qb = this.repo.createQueryBuilder('w');
    if (filter.ownerId) qb.where('w.ownerId = :oid', { oid: filter.ownerId });
    qb.take(filter.limit).skip(filter.offset);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(r => this.toDomain(r)), total };
  }

  private toOrm(workspace: Workspace): WorkspaceOrmEntity {
    const orm = new WorkspaceOrmEntity();
    orm.id = workspace.id.value;
    orm.slug = workspace.props.slug;
    orm.name = workspace.props.name;
    orm.ownerId = workspace.props.ownerId.value;
    orm.planId = workspace.props.planId?.value ?? null;
    orm.archived = workspace.props.archived;
    return orm;
  }

  private toDomain(row: WorkspaceOrmEntity): Workspace {
    return Workspace.reconstitute({
      id: WorkspaceId.from(row.id),
      slug: row.slug,
      name: row.name,
      ownerId: row.ownerId,
      planId: row.planId,
      archived: row.archived,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
