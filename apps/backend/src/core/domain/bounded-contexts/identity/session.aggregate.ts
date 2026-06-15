/**
 * File:        core/domain/bounded-contexts/identity/session.aggregate.ts
 * Module:      Domain - Identity Bounded Context
 * Purpose:     Session aggregate for JWT refresh token management and security
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result, makeResult } from '../../shared/result';
import { UserId } from '../../shared/value-objects/ids';
import { DomainEvent } from '../../shared/domain-event';
import { PasswordHash } from './value-objects/password-hash';

export interface SessionProps {
  id: string;
  userId: UserId;
  refreshTokenHash: PasswordHash;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
}

export class Session extends AggregateRoot<SessionProps> {
  private constructor(props: SessionProps) {
    super(props);
  }

  static create(
    userId: UserId,
    refreshTokenHash: PasswordHash,
    ipAddress?: string,
    userAgent?: string,
    expiresAt?: Date
  ): Result<Session, SessionValidationError> {
    if (!expiresAt) {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default
    }

    const props: SessionProps = {
      id: crypto.randomUUID(),
      userId,
      refreshTokenHash,
      ipAddress,
      userAgent,
      expiresAt
    };

    const session = new Session(props);
    session.addDomainEvent(new SessionCreatedEvent(session));

    return Result.ok(session);
  }

  revoke(reason: string = 'unknown'): void {
    if (this.props.revokedAt) return;

    this.props.revokedAt = new Date();
    this.props.revokedReason = reason;
    this.incrementVersion();
    this.addDomainEvent(new SessionRevokedEvent(this, reason));
  }

  isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  rotate(newRefreshTokenHash: PasswordHash): void {
    if (this.props.revokedAt) {
      throw new Error('Cannot rotate revoked session');
    }

    this.props.refreshTokenHash = newRefreshTokenHash;
    this.props.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    this.incrementVersion();
    this.addDomainEvent(new SessionRotatedEvent(this));
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get refreshTokenHash(): PasswordHash {
    return this.props.refreshTokenHash;
  }

  get ipAddress(): string | undefined {
    return this.props.ipAddress;
  }

  get userAgent(): string | undefined {
    return this.props.userAgent;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | undefined {
    return this.props.revokedAt;
  }

  get revokedReason(): string | undefined {
    return this.props.revokedReason;
  }

  get isActive(): boolean {
    return !this.props.revokedAt && !this.isExpired();
  }
}

export class SessionValidationError extends Error {
  readonly kind = 'SessionValidationError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SessionValidationError';
  }
}

export class SessionCreatedEvent implements DomainEvent {
  readonly type = 'session.created' as const;
  readonly aggregateId: string;
  readonly occurredAt = new Date();

  constructor(public readonly session: Session) {
    this.aggregateId = session.id;
  }
}

export class SessionRevokedEvent implements DomainEvent {
  readonly type = 'session.revoked' as const;
  readonly aggregateId: string;
  readonly occurredAt = new Date();

  constructor(
    public readonly session: Session,
    public readonly reason: string
  ) {
    this.aggregateId = session.id;
  }
}

export class SessionRotatedEvent implements DomainEvent {
  readonly type = 'session.rotated' as const;
  readonly aggregateId: string;
  readonly occurredAt = new Date();

  constructor(public readonly session: Session) {
    this.aggregateId = session.id;
  }
}