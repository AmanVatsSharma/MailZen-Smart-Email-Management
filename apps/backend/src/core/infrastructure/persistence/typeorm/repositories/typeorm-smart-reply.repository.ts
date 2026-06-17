/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-smart-reply.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing ISmartReplyRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ISmartReplyRepository } from '../../../../application/ports/repositories/smart-reply.repository';
import { SmartReply } from '../../../../domain/bounded-contexts/ai/smart-reply.aggregate';
import { Result } from '../../../../domain/shared/result';
import { SmartReplyOrmEntity } from '../entities/smart-reply.orm-entity';

@Injectable()
export class TypeOrmSmartReplyRepository implements ISmartReplyRepository {
  constructor(
    @InjectRepository(SmartReplyOrmEntity)
    private readonly repo: Repository<SmartReplyOrmEntity>,
  ) {}

  async save(reply: SmartReply): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(reply);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: string): Promise<SmartReply | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async listForEmail(emailId: string, userId: string): Promise<SmartReply[]> {
    const rows = await this.repo.find({
      where: { emailId, userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(r => this.toDomain(r));
  }

  private toOrm(reply: SmartReply): SmartReplyOrmEntity {
    const orm = new SmartReplyOrmEntity();
    orm.id = reply.props.id;
    orm.emailId = reply.props.emailId;
    orm.userId = reply.props.userId;
    orm.tone = reply.props.tone;
    orm.body = reply.props.body;
    orm.status = reply.props.status;
    return orm;
  }

  private toDomain(row: SmartReplyOrmEntity): SmartReply {
    return SmartReply.reconstitute({
      id: row.id,
      emailId: row.emailId,
      userId: row.userId,
      tone: row.tone,
      body: row.body,
      status: row.status as never,
      createdAt: row.createdAt,
    });
  }
}
