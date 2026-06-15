/**
 * File:        core/testing/in-memory-user.repository.ts
 * Module:      Testing
 * Purpose:     In-memory implementation of IUserRepository for use case specs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IUserRepository } from 'application/ports/repositories/user.repository';
import { User, UserRole } from '../domain/bounded-contexts/identity/user.aggregate';
import { Result } from '../domain/shared/result';
import { UserId } from '../domain/shared/value-objects/ids';

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async save(user: User): Promise<Result<void, Error>> {
    this.users.set(user.id, user);
    return Result.ok(undefined);
  }

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toString() === normalized) {
        return user;
      }
    }
    return null;
  }

  async list(filter: { limit: number; offset: number; role?: UserRole }): Promise<{ items: User[]; total: number }> {
    let items = Array.from(this.users.values());
    if (filter.role) {
      items = items.filter(u => u.role === filter.role);
    }
    const total = items.length;
    const paginated = items.slice(filter.offset, filter.offset + filter.limit);
    return { items: paginated, total };
  }

  // Test helper
  clear(): void {
    this.users.clear();
  }
}