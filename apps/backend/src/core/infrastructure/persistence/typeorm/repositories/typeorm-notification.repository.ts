/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-notification.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing INotificationRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { INotificationRepository } from '../../../../application/ports/repositories/notification.repository';
import { Notification } from '../../../../domain/bounded-contexts/notifications/notification.aggregate';
import { Result } from '../../../../domain/shared/result';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';

@Injectable()
export class TypeOrmNotificationRepository implements INotificationRepository {
  constructor(
    @InjectRepository(NotificationOrmEntity)
    private readonly repo: Repository<NotificationOrmEntity>,
  ) {}

  async save(notification: Notification): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(notification);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async listForUser(
    userId: string,
    unreadOnly: boolean,
    limit: number,
    offset: number,
  ): Promise<{ items: Notification[]; total: number; unreadCount: number }> {
    const qb = this.repo.createQueryBuilder('n')
      .where('n.userId = :uid', { uid: userId });
    if (unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }
    qb.take(limit).skip(offset).orderBy('n.createdAt', 'DESC');
    const [rows, total] = await qb.getManyAndCount();
    const unreadCount = await this.repo.count({ where: { userId, readAt: null } });
    return { items: rows.map(r => this.toDomain(r)), total, unreadCount };
  }

  async markRead(id: string): Promise<Result<void, Error>> {
    try {
      await this.repo.update({ id }, { readAt: new Date() });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(n: Notification): NotificationOrmEntity {
    const orm = new NotificationOrmEntity();
    orm.id = n.props.id;
    orm.userId = n.props.userId;
    orm.type = n.props.type;
    orm.title = n.props.title;
    orm.body = n.props.body;
    orm.payload = n.props.payload;
    orm.readAt = n.props.readAt;
    orm.createdAt = n.props.createdAt;
    return orm;
  }

  private toDomain(row: NotificationOrmEntity): Notification {
    return Notification.reconstitute({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      payload: row.payload,
      readAt: row.readAt,
      createdAt: row.createdAt,
    });
  }
}
