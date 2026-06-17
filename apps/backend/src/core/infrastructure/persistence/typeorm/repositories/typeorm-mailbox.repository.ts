/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-mailbox.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IMailboxRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IMailboxRepository } from '../../../../application/ports/repositories/mailbox.repository';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { Result } from '../../../../domain/shared/result';
import { MailboxId, UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { MailboxOrmEntity } from '../entities/mailbox.orm-entity';

@Injectable()
export class TypeOrmMailboxRepository implements IMailboxRepository {
  constructor(
    @InjectRepository(MailboxOrmEntity)
    private readonly repo: Repository<MailboxOrmEntity>,
  ) {}

  async save(mailbox: Mailbox): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(mailbox);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: MailboxId): Promise<Mailbox | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async listByUser(userId: UserId, workspaceId: WorkspaceId): Promise<Mailbox[]> {
    const rows = await this.repo.find({
      where: { userId: userId.value, workspaceId: workspaceId.value },
    });
    return rows.map(r => this.toDomain(r));
  }

  async setPrimary(mailboxId: MailboxId, userId: UserId): Promise<Result<void, Error>> {
    try {
      await this.repo.update(
        { userId: userId.value, isPrimary: true },
        { isPrimary: false },
      );
      await this.repo.update({ id: mailboxId.value }, { isPrimary: true });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(mailbox: Mailbox): MailboxOrmEntity {
    const orm = new MailboxOrmEntity();
    orm.id = mailbox.props.id;
    orm.workspaceId = mailbox.props.workspaceId.value;
    orm.userId = mailbox.props.userId.value;
    orm.provider = mailbox.props.provider;
    orm.emailAddress = mailbox.props.emailAddress;
    orm.isPrimary = mailbox.props.isPrimary;
    orm.isConnected = mailbox.props.isConnected;
    orm.syncCursor = mailbox.props.syncCursor;
    orm.lastSyncedAt = mailbox.props.lastSyncedAt;
    return orm;
  }

  private toDomain(row: MailboxOrmEntity): Mailbox {
    return Mailbox.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      userId: UserId.from(row.userId),
      provider: row.provider as never,
      emailAddress: row.emailAddress,
      isPrimary: row.isPrimary,
      isConnected: row.isConnected,
      syncCursor: row.syncCursor,
      lastSyncedAt: row.lastSyncedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
