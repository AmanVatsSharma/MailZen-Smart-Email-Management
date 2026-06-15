/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-email-warmup.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IEmailWarmupRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEmailWarmupRepository } from '../../../application/ports/repositories/email-warmup.repository';
import { Warmup } from '../../../../domain/bounded-contexts/messaging/warmup.aggregate';
import { Result } from '../../../../domain/shared/result';
import { WarmupId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { EmailWarmupOrmEntity } from '../entities/email-warmup.orm-entity';

@Injectable()
export class TypeOrmEmailWarmupRepository implements IEmailWarmupRepository {
  constructor(
    @InjectRepository(EmailWarmupOrmEntity)
    private readonly repo: Repository<EmailWarmupOrmEntity>,
  ) {}

  async save(warmup: Warmup): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(warmup);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: WarmupId): Promise<Warmup | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async findActiveForWorkspace(workspaceId: WorkspaceId): Promise<Warmup[]> {
    const rows = await this.repo.find({
      where: { workspaceId: workspaceId.value, status: 'active' },
    });
    return rows.map(r => this.toDomain(r));
  }

  private toOrm(w: Warmup): EmailWarmupOrmEntity {
    const orm = new EmailWarmupOrmEntity();
    orm.id = w.id.value;
    orm.workspaceId = w.props.workspaceId.value;
    orm.mailboxId = w.props.mailboxId;
    orm.dailyTarget = w.props.dailyTarget;
    orm.sentToday = w.props.sentToday;
    orm.status = w.props.status;
    orm.startedAt = w.props.startedAt;
    return orm;
  }

  private toDomain(row: EmailWarmupOrmEntity): Warmup {
    return Warmup.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      mailboxId: row.mailboxId,
      dailyTarget: row.dailyTarget,
      sentToday: row.sentToday,
      status: row.status as never,
      startedAt: row.startedAt,
      createdAt: row.createdAt,
    });
  }
}
