/**
 * File:        core/application/ports/repositories/session.repository.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Repository port for Session aggregate persistence
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Session } from '../../../domain/bounded-contexts/identity/session.aggregate';
import { Result } from '../../../domain/shared/result';
import { UserId } from '../../../domain/shared/value-objects/ids';

export const SESSION_REPOSITORY = Symbol('ISessionRepository');

export interface ISessionRepository {
  save(session: Session): Promise<Result<void, Error>>;
  findById(id: string): Promise<Session | null>;
  findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null>;
  revokeAllForUser(userId: UserId): Promise<Result<void, Error>>;
}