// apps/backend/src/core/infrastructure/persistence/typeorm/repositories/typeorm-user.repository.ts
// Adapter: implements IUserRepository.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IUserRepository } from '../../../application/ports/repositories/user.repository';
import { User, UserRole } from '../../../../domain/bounded-contexts/identity/user.aggregate';
import { Result } from '../../../../domain/shared/result';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { UserOrmEntity } from '../entities/user.orm-entity';

@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async save(user: User): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(user);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: UserId): Promise<User | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { email: email.toLowerCase() } });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: { limit: number; offset: number; role?: UserRole }) {
    const qb = this.repo.createQueryBuilder('u');
    if (filter.role) qb.where('u.role = :r', { r: filter.role });
    qb.take(filter.limit).skip(filter.offset);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(r => this.toDomain(r)), total };
  }

  private toOrm(user: User): UserOrmEntity {
    const orm = new UserOrmEntity();
    orm.id = user.id.value;
    orm.email = user.email.toString();
    orm.role = user.role;
    orm.emailVerifiedAt = user.emailVerifiedAt;
    orm.is2faEnabled = user.is2faEnabled;
    orm.createdAt = new Date();
    orm.updatedAt = new Date();
    return orm;
  }

  private toDomain(row: UserOrmEntity): User {
    return User.reconstitute({
      id: UserId.from(row.id),
      email: row.email,
      role: row.role as UserRole,
      emailVerifiedAt: row.emailVerifiedAt,
      is2faEnabled: row.is2faEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
