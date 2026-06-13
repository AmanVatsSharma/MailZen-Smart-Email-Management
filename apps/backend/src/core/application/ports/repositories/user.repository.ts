// apps/backend/src/core/application/ports/repositories/user.repository.ts
// Port: persistence of User aggregate. Use case depends on this, not TypeORM.

import { User, UserRole } from '../../../domain/bounded-contexts/identity/user.aggregate';
import { Result } from '../../../domain/shared/result';
import { UserId } from '../../../domain/shared/value-objects/ids';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface IUserRepository {
  save(user: User): Promise<Result<void, Error>>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(filter: { limit: number; offset: number; role?: UserRole }): Promise<{ items: User[]; total: number }>;
}
