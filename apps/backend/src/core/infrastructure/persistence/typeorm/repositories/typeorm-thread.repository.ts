/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-thread.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IThreadRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IThreadRepository } from '../../../../application/ports/repositories/thread.repository';
import { Thread } from '../../../../domain/bounded-contexts/messaging/thread.aggregate';
import { Result } from '../../../../domain/shared/result';
import { ThreadId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { ThreadOrmEntity } from '../entities/thread.orm-entity';

@Injectable()
export class TypeOrmThreadRepository implements IThreadRepository {
  constructor(
    @InjectRepository(ThreadOrmEntity)
    private readonly repo: Repository<ThreadOrmEntity>,
  ) {}

  async save(thread: Thread): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(thread);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: ThreadId): Promise<Thread | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async listByWorkspace(
    workspaceId: WorkspaceId,
    limit: number,
    offset: number,
  ): Promise<{ items: Thread[]; total: number }> {
    const [rows, total] = await this.repo.findAndCount({
      where: { workspaceId: workspaceId.value },
      take: limit,
      skip: offset,
      order: { lastMessageAt: 'DESC' },
    });
    return { items: rows.map(r => this.toDomain(r)), total };
  }

  private toOrm(thread: Thread): ThreadOrmEntity {
    const orm = new ThreadOrmEntity();
    orm.id = thread.props.id;
    orm.workspaceId = thread.props.workspaceId.value;
    orm.subject = thread.props.subject;
    orm.participants = thread.props.participants;
    orm.lastMessageAt = thread.props.lastMessageAt;
    orm.messageCount = thread.props.messageCount;
    orm.isRead = thread.props.isRead;
    return orm;
  }

  private toDomain(row: ThreadOrmEntity): Thread {
    return Thread.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      subject: row.subject,
      participants: row.participants,
      lastMessageAt: row.lastMessageAt,
      messageCount: row.messageCount,
      isRead: row.isRead,
      createdAt: row.createdAt,
    });
  }
}
