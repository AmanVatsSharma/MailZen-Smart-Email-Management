/**
 * File:        core/testing/in-memory-session.repository.ts
 * Module:      Testing
 * Purpose:     In-memory implementation of ISessionRepository for use case specs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ISessionRepository } from 'application/ports/repositories/session.repository';
import { Session } from '../domain/bounded-contexts/identity/session.aggregate';
import { Result } from '../domain/shared/result';
import { UserId } from '../domain/shared/value-objects/ids';

export class InMemorySessionRepository implements ISessionRepository {
  private sessions: Map<string, Session> = new Map();

  async save(session: Session): Promise<Result<void, Error>> {
    this.sessions.set(session.id, session);
    return Result.ok(undefined);
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    for (const session of this.sessions.values()) {
      if (session.refreshTokenHash.toString() === refreshTokenHash) {
        return session;
      }
    }
    return null;
  }

  async revokeAllForUser(userId: UserId): Promise<Result<void, Error>> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.revoke('bulk_revoke');
      }
    }
    return Result.ok(undefined);
  }

  // Test helper
  clear(): void {
    this.sessions.clear();
  }
}