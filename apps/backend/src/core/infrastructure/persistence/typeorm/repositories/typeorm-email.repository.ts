/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-email.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IEmailRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { IEmailRepository, EmailListFilter, EmailListResult } from '../../../../application/ports/repositories/email.repository';
import { Email, EmailStatus } from '../../../../domain/bounded-contexts/messaging/email.aggregate';
import { Result } from '../../../../domain/shared/result';
import { EmailOrmEntity } from '../entities/email.orm-entity';
import { EmailMapper } from '../mappers/email.mapper';

@Injectable()
export class TypeOrmEmailRepository implements IEmailRepository {
  constructor(
    @InjectRepository(EmailOrmEntity)
    private readonly repo: Repository<EmailOrmEntity>,
  ) {}

  async save(email: Email): Promise<Result<void, Error>> {
    try {
      const orm = EmailMapper.toOrm(email);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: string, workspaceId: { value: string }): Promise<Email | null> {
    const row = await this.repo.findOne({ where: { id, workspaceId: workspaceId.value } });
    return row ? EmailMapper.toDomain(row) : null;
  }

  async list(filter: EmailListFilter): Promise<EmailListResult> {
    const qb = this.repo.createQueryBuilder('e')
      .where('e.workspaceId = :ws', { ws: filter.workspaceId.value });
    if (filter.status) qb.andWhere('e.status = :s', { s: filter.status });
    if (filter.from) qb.andWhere('e.createdAt >= :f', { f: filter.from });
    if (filter.to) qb.andWhere('e.createdAt <= :t', { t: filter.to });
    if (filter.threadId) qb.andWhere('e.threadId = :tid', { tid: filter.threadId });
    if (filter.authorId) qb.andWhere('e.authorId = :aid', { aid: filter.authorId });
    qb.orderBy('e.createdAt', 'DESC').take(filter.limit).skip(filter.offset);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(EmailMapper.toDomain), total };
  }

  async delete(id: string, workspaceId: { value: string }): Promise<Result<void, Error>> {
    try {
      await this.repo.delete({ id, workspaceId: workspaceId.value });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findScheduledBefore(date: Date): Promise<Email[]> {
    const rows = await this.repo.find({ where: { status: 'SCHEDULED', scheduledAt: LessThanOrEqual(date) } });
    return rows.map(EmailMapper.toDomain);
  }
}
