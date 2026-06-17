/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-label.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter for Label repository.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ILabelRepository } from '../../../../application/ports/repositories/label.repository';
import { Label } from '../../../../domain/bounded-contexts/organization/label.aggregate';
import { Result } from '../../../../domain/shared/result';
import { WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { LabelOrmEntity } from '../entities/label.orm-entity';

@Injectable()
export class TypeOrmLabelRepository implements ILabelRepository {
  constructor(
    @InjectRepository(LabelOrmEntity)
    private readonly repo: Repository<LabelOrmEntity>,
  ) {}

  async save(label: Label): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(label);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: string): Promise<Label | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Label[]> {
    const rows = await this.repo.find({
      where: { workspaceId: workspaceId.value },
      order: { name: 'ASC' },
    });
    return rows.map(r => this.toDomain(r));
  }

  async delete(id: string): Promise<Result<void, Error>> {
    try {
      await this.repo.delete({ id });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(l: Label): LabelOrmEntity {
    const orm = new LabelOrmEntity();
    orm.id = l.id;
    orm.workspaceId = l.props.workspaceId.value;
    orm.name = l.props.name;
    orm.color = l.props.color;
    orm.parentId = l.props.parentId;
    return orm;
  }

  private toDomain(row: LabelOrmEntity): Label {
    return Label.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      name: row.name,
      color: row.color,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
