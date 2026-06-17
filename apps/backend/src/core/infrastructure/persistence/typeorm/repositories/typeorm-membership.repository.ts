/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-membership.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IMembershipRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IMembershipRepository } from '../../../../application/ports/repositories/membership.repository';
import { Membership } from '../../../../domain/bounded-contexts/workspaces/membership.aggregate';
import { Result } from '../../../../domain/shared/result';
import { UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { MembershipOrmEntity } from '../entities/membership.orm-entity';

@Injectable()
export class TypeOrmMembershipRepository implements IMembershipRepository {
  constructor(
    @InjectRepository(MembershipOrmEntity)
    private readonly repo: Repository<MembershipOrmEntity>,
  ) {}

  async save(membership: Membership): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(membership);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findByWorkspaceAndUser(workspaceId: WorkspaceId, userId: UserId): Promise<Membership | null> {
    const row = await this.repo.findOne({
      where: { workspaceId: workspaceId.value, userId: userId.value },
    });
    return row ? this.toDomain(row) : null;
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Membership[]> {
    const rows = await this.repo.find({ where: { workspaceId: workspaceId.value } });
    return rows.map(r => this.toDomain(r));
  }

  async delete(id: string): Promise<Result<void, Error>> {
    try {
      await this.repo.delete({ id });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(m: Membership): MembershipOrmEntity {
    const orm = new MembershipOrmEntity();
    orm.id = m.props.id;
    orm.workspaceId = m.props.workspaceId.value;
    orm.userId = m.props.userId.value;
    orm.role = m.props.role;
    orm.invitedAt = m.props.invitedAt;
    orm.joinedAt = m.props.joinedAt;
    return orm;
  }

  private toDomain(row: MembershipOrmEntity): Membership {
    return Membership.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      userId: UserId.from(row.userId),
      role: row.role as never,
      invitedAt: row.invitedAt,
      joinedAt: row.joinedAt,
      createdAt: row.createdAt,
    });
  }
}
