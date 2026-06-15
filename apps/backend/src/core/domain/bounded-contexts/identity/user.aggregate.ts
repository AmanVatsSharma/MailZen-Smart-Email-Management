// apps/backend/src/core/domain/bounded-contexts/identity/user.aggregate.ts
// User aggregate root. Owns user invariants and behaviors.

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result, makeResult } from '../../shared/result';
import { UserId } from '../../shared/value-objects/ids';
import { EmailAddress } from '../../shared/value-objects/email-address';
import { DomainEvent } from '../../shared/domain-event';

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

export interface UserProps {
  id: UserId;
  email: EmailAddress;
  role: UserRole;
  emailVerifiedAt: Date | null;
  is2faEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot<UserProps> {
  private constructor(props: UserProps) {
    super(props);
  }

  static register(
    email: EmailAddress,
    role: UserRole = UserRole.User,
  ): Result<User, UserValidationError> {
    if (!EmailAddress.create(email.toString()).isOk()) {
      return Result.err(new UserValidationError('invalid email'));
    }
    return Result.ok(new User({
      id: UserId.create(crypto.randomUUID()).unwrap(),
      email,
      role,
      emailVerifiedAt: null,
      is2faEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  markEmailVerified(): void {
    if (this.props.emailVerifiedAt) return;
    this.props.emailVerifiedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new UserEmailVerifiedEvent(this));
  }

  enable2fa(): void {
    if (this.props.is2faEnabled) return;
    this.props.is2faEnabled = true;
    this.incrementVersion();
    this.addDomainEvent(new User2faEnabledEvent(this));
  }

  disable2fa(): void {
    if (!this.props.is2faEnabled) return;
    this.props.is2faEnabled = false;
    this.incrementVersion();
    this.addDomainEvent(new User2faDisabledEvent(this));
  }

  get id(): UserId { return this.props.id; }
  get email(): EmailAddress { return this.props.email; }
  get role(): UserRole { return this.props.role; }
  get isEmailVerified(): boolean { return this.props.emailVerifiedAt !== null; }
  get is2faEnabled(): boolean { return this.props.is2faEnabled; }
  get emailVerifiedAt(): Date | null { return this.props.emailVerifiedAt; }
}

export class UserValidationError extends Error {
  readonly kind = 'UserValidationError' as const;
  constructor(message: string) { super(message); }
}

export class UserEmailVerifiedEvent implements DomainEvent {
  readonly type = 'user.email_verified' as const;
  readonly aggregateId: string;
  readonly occurredAt = new Date();
  constructor(public readonly user: User) { this.aggregateId = user.id; }
}
export class User2faEnabledEvent implements DomainEvent {
  readonly type = 'user.2fa_enabled' as const;
  readonly aggregateId: string;
  readonly occurredAt = new Date();
  constructor(public readonly user: User) { this.aggregateId = user.id; }
}
export class User2faDisabledEvent implements DomainEvent {
  readonly type = 'user.2fa_disabled' as const;
  readonly aggregateId: string;
  readonly occurredAt = new Date();
  constructor(public readonly user: User) { this.aggregateId = user.id; }
}
