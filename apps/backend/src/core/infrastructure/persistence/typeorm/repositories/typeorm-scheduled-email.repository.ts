/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-scheduled-email.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter for ScheduledEmail repository.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { IScheduledEmailRepository } from '../../../../application/ports/repositories/scheduled-email.repository';
import { ScheduledEmail } from '../../../../domain/bounded-contexts/scheduled-email/scheduled-email.aggregate';
import { Result } from '../../../../domain/shared/result';
import { EmailId, UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { ScheduledEmailOrmEntity } from '../entities/scheduled-email.orm-entity';

@Injectable()
export class TypeOrmScheduledEmailRepository implements IScheduledEmailRepository {
  constructor(
    @InjectRepository(ScheduledEmailOrmEntity)
    private readonly repo: Repository<ScheduledEmailOrmEntity>,
  ) {}

  async save(scheduled: ScheduledEmail): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(scheduled);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: string): Promise<ScheduledEmail | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async listDue(before: Date, limit: number): Promise<ScheduledEmail[]> {
    const rows = await this.repo.find({
      where: { status: 'pending', scheduledFor: LessThanOrEqual(before) },
      take: limit,
    });
    return rows.map(r => this.toDomain(r));
  }

  async cancel(id: string): Promise<Result<void, Error>> {
    try {
      await this.repo.update({ id, status: 'pending' }, { status: 'cancelled' });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(s: ScheduledEmail): ScheduledEmailOrmEntity {
    const orm = new ScheduledEmailOrmEntity();
    orm.id = s.id;
    orm.emailId = s.props.emailId.value;
    orm.workspaceId = s.props.workspaceId.value;
    orm.senderId = s.props.senderId.value;
    orm.scheduledFor = s.props.scheduledFor;
    orm.status = s.props.status;
    orm.sentAt = s.props.sentAt;
    orm.failureReason = s.props.failureReason;
    return orm;
  }

  private toDomain(row: ScheduledEmailOrmEntity): ScheduledEmail {
    return ScheduledEmail.reconstitute({
      id: row.id,
      emailId: EmailId.from(row.emailId),
      workspaceId: WorkspaceId.from(row.workspaceId),
      senderId: UserId.from(row.senderId),
      scheduledFor: row.scheduledFor,
      status: row.status as never,
      sentAt: row.sentAt,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
    });
  }
}
