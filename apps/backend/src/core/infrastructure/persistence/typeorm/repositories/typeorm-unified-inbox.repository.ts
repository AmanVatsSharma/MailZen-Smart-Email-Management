/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-unified-inbox.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter for unified-thread and inbox-folder repositories.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IInboxFolderRepository,
  IUnifiedThreadRepository,
} from '../../../application/ports/repositories/unified-inbox.repository';
import { InboxFolder, UnifiedThread } from '../../../../domain/bounded-contexts/unified-inbox/unified-thread.aggregate';
import { Result } from '../../../../domain/shared/result';
import { UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { InboxFolderOrmEntity } from '../entities/inbox-folder.orm-entity';
import { UnifiedThreadOrmEntity } from '../entities/unified-thread.orm-entity';

@Injectable()
export class TypeOrmUnifiedThreadRepository implements IUnifiedThreadRepository {
  constructor(
    @InjectRepository(UnifiedThreadOrmEntity)
    private readonly repo: Repository<UnifiedThreadOrmEntity>,
  ) {}

  async save(thread: UnifiedThread): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(thread);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: string): Promise<UnifiedThread | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async listForUser(filter: {
    userId: UserId;
    workspaceId: WorkspaceId;
    folderId?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: UnifiedThread[]; total: number }> {
    const qb = this.repo.createQueryBuilder('t')
      .where('t.userId = :uid AND t.workspaceId = :ws', {
        uid: filter.userId.value,
        ws: filter.workspaceId.value,
      });
    if (filter.folderId) {
      qb.andWhere('t.folderId = :fid', { fid: filter.folderId });
    }
    qb.take(filter.limit).skip(filter.offset).orderBy('t.lastMessageAt', 'DESC');
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(r => this.toDomain(r)), total };
  }

  private toOrm(t: UnifiedThread): UnifiedThreadOrmEntity {
    const orm = new UnifiedThreadOrmEntity();
    orm.id = t.id;
    orm.workspaceId = t.props.workspaceId.value;
    orm.userId = t.props.userId.value;
    orm.subject = t.props.subject;
    orm.participants = t.props.participants;
    orm.providerThreadIds = t.props.providerThreadIds;
    orm.lastMessageAt = t.props.lastMessageAt;
    orm.messageCount = t.props.messageCount;
    orm.unread = t.props.unread;
    orm.starred = t.props.starred;
    orm.folderId = t.props.folderId;
    return orm;
  }

  private toDomain(row: UnifiedThreadOrmEntity): UnifiedThread {
    return UnifiedThread.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      userId: UserId.from(row.userId),
      subject: row.subject,
      participants: row.participants ?? [],
      providerThreadIds: row.providerThreadIds ?? {},
      lastMessageAt: row.lastMessageAt,
      messageCount: row.messageCount,
      unread: row.unread,
      starred: row.starred,
      folderId: row.folderId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

@Injectable()
export class TypeOrmInboxFolderRepository implements IInboxFolderRepository {
  constructor(
    @InjectRepository(InboxFolderOrmEntity)
    private readonly repo: Repository<InboxFolderOrmEntity>,
  ) {}

  async save(folder: InboxFolder): Promise<Result<void, Error>> {
    try {
      const orm = new InboxFolderOrmEntity();
      orm.id = folder.id;
      orm.workspaceId = folder.props.workspaceId.value;
      orm.userId = folder.props.userId.value;
      orm.name = folder.props.name;
      orm.kind = folder.props.kind;
      orm.parentId = folder.props.parentId;
      orm.unreadCount = folder.props.unreadCount;
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async listForUser(userId: UserId, workspaceId: WorkspaceId): Promise<InboxFolder[]> {
    const rows = await this.repo.find({
      where: { userId: userId.value, workspaceId: workspaceId.value },
      order: { name: 'ASC' },
    });
    return rows.map(r => InboxFolder.reconstitute({
      id: r.id,
      workspaceId: WorkspaceId.from(r.workspaceId),
      userId: UserId.from(r.userId),
      name: r.name,
      kind: r.kind as never,
      parentId: r.parentId,
      unreadCount: r.unreadCount,
      createdAt: r.createdAt,
    }));
  }
}
