/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-sender-profile.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing ISenderProfileRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ISenderProfileRepository } from '../../../../application/ports/repositories/sender-profile.repository';
import { SenderProfile } from '../../../../domain/bounded-contexts/ai/sender-profile.aggregate';
import { Result } from '../../../../domain/shared/result';
import { SenderProfileOrmEntity } from '../entities/sender-profile.orm-entity';

@Injectable()
export class TypeOrmSenderProfileRepository implements ISenderProfileRepository {
  constructor(
    @InjectRepository(SenderProfileOrmEntity)
    private readonly repo: Repository<SenderProfileOrmEntity>,
  ) {}

  async save(profile: SenderProfile): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(profile);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findByEmail(email: string, userId: string): Promise<SenderProfile | null> {
    const row = await this.repo.findOne({ where: { email, userId } });
    return row ? this.toDomain(row) : null;
  }

  async listByUser(userId: string, limit: number, offset: number): Promise<{ items: SenderProfile[]; total: number }> {
    const [rows, total] = await this.repo.findAndCount({
      where: { userId },
      take: limit,
      skip: offset,
      order: { interactionCount: 'DESC' },
    });
    return { items: rows.map(r => this.toDomain(r)), total };
  }

  private toOrm(p: SenderProfile): SenderProfileOrmEntity {
    const orm = new SenderProfileOrmEntity();
    orm.id = p.props.id;
    orm.userId = p.props.userId;
    orm.email = p.props.email;
    orm.displayName = p.props.displayName;
    orm.trustScore = p.props.trustScore;
    orm.interactionCount = p.props.interactionCount;
    orm.avgResponseTimeSeconds = p.props.avgResponseTimeSeconds;
    orm.lastInteractionAt = p.props.lastInteractionAt;
    orm.tags = p.props.tags;
    return orm;
  }

  private toDomain(row: SenderProfileOrmEntity): SenderProfile {
    return SenderProfile.reconstitute({
      id: row.id,
      userId: row.userId,
      email: row.email,
      displayName: row.displayName,
      trustScore: row.trustScore,
      interactionCount: row.interactionCount,
      avgResponseTimeSeconds: row.avgResponseTimeSeconds,
      lastInteractionAt: row.lastInteractionAt,
      tags: row.tags,
      createdAt: row.createdAt,
    });
  }
}
