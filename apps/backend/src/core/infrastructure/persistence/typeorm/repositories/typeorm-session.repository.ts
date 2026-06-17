/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-session.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing ISessionRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ISessionRepository } from '../../../../application/ports/repositories/session.repository';
import { Session } from '../../../../domain/bounded-contexts/identity/session.aggregate';
import { Result } from '../../../../domain/shared/result';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { SessionOrmEntity } from '../entities/session.orm-entity';

@Injectable()
export class TypeOrmSessionRepository implements ISessionRepository {
  constructor(
    @InjectRepository(SessionOrmEntity)
    private readonly repo: Repository<SessionOrmEntity>,
  ) {}

  async save(session: Session): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(session);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: string): Promise<Session | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    const row = await this.repo.findOne({ where: { refreshTokenHash } });
    return row ? this.toDomain(row) : null;
  }

  async revokeAllForUser(userId: UserId): Promise<Result<void, Error>> {
    try {
      await this.repo.update(
        { userId: userId.value, revokedAt: null },
        { revokedAt: new Date() },
      );
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(session: Session): SessionOrmEntity {
    const orm = new SessionOrmEntity();
    orm.id = session.id;
    orm.userId = session.props.userId;
    orm.refreshTokenHash = session.props.refreshTokenHash;
    orm.ipAddress = session.props.ipAddress;
    orm.userAgent = session.props.userAgent;
    orm.expiresAt = session.props.expiresAt;
    orm.revokedAt = session.props.revokedAt;
    return orm;
  }

  private toDomain(row: SessionOrmEntity): Session {
    return Session.reconstitute({
      id: row.id,
      userId: row.userId,
      refreshTokenHash: row.refreshTokenHash,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    });
  }
}
