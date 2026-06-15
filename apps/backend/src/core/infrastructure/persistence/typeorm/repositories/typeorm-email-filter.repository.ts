/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-email-filter.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IEmailFilterRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEmailFilterRepository } from '../../../application/ports/repositories/email-filter.repository';
import { EmailFilter } from '../../../../domain/bounded-contexts/messaging/email-filter.specification';
import { Result } from '../../../../domain/shared/result';
import { EmailFilterId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { EmailFilterOrmEntity } from '../entities/email-filter.orm-entity';

@Injectable()
export class TypeOrmEmailFilterRepository implements IEmailFilterRepository {
  constructor(
    @InjectRepository(EmailFilterOrmEntity)
    private readonly repo: Repository<EmailFilterOrmEntity>,
  ) {}

  async save(filter: EmailFilter): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(filter);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: EmailFilterId): Promise<EmailFilter | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<EmailFilter[]> {
    const rows = await this.repo.find({
      where: { workspaceId: workspaceId.value },
      order: { priority: 'ASC' },
    });
    return rows.map(r => this.toDomain(r));
  }

  async delete(id: EmailFilterId): Promise<Result<void, Error>> {
    try {
      await this.repo.delete({ id: id.value });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(f: EmailFilter): EmailFilterOrmEntity {
    const orm = new EmailFilterOrmEntity();
    orm.id = f.id.value;
    orm.workspaceId = f.props.workspaceId.value;
    orm.name = f.props.name;
    orm.conditions = f.props.conditions;
    orm.actions = f.props.actions;
    orm.priority = f.props.priority;
    orm.enabled = f.props.enabled;
    return orm;
  }

  private toDomain(row: EmailFilterOrmEntity): EmailFilter {
    return EmailFilter.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      name: row.name,
      conditions: row.conditions,
      actions: row.actions,
      priority: row.priority,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
