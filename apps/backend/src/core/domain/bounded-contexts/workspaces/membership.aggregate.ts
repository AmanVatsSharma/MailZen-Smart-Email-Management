/**
 * File:        apps/backend/src/core/domain/bounded-contexts/workspaces/membership.aggregate.ts
 * Module:      Workspace Domain
 * Purpose:     Membership aggregate with business logic and domain events
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';
import { Result, makeResult } from '../../shared/result';
import { Role } from './value-objects/role';

export interface MembershipProps {
  id: string;
  workspaceId: string;
  userId?: string | null;
  email: string;
  role: Role;
  status: 'active' | 'pending' | 'declined' | 'removed';
  invitedByUserId: string;
  joinedAt?: Date | null;
  removedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Membership extends AggregateRoot<MembershipProps> {
  static create(props: Omit<MembershipProps, 'id' | 'createdAt' | 'updatedAt'>): Result<Membership> {
    return Result.ok(
      new Membership({
        ...props,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  changeRole(newRole: Role): Result<void> {
    if (this.props.role === newRole) {
      return Result.err(new ValidationError('Cannot change to the same role'));
    }

    if (this.props.status === 'removed') {
      return Result.err(new ValidationError('Cannot change role of a removed member'));
    }

    if (this.props.status === 'declined') {
      return Result.err(new ValidationError('Cannot change role of a declined member'));
    }

    const previousRole = this.props.role;
    this.props.role = newRole;
    this.props.updatedAt = new Date();

    if (this.props.status === 'pending') {
      this.props.status = 'active';
      this.props.joinedAt = new Date();
    }

    this.addDomainEvent(new MemberRoleChangedEvent(
      this.props.id,
      this.props.workspaceId,
      previousRole,
      newRole,
      this.props.userId || null,
    ));

    return Result.ok();
  }

  remove(): void {
    if (this.props.status === 'removed') {
      return;
    }

    this.props.status = 'removed';
    this.props.removedAt = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new MemberRemovedEvent(
      this.props.id,
      this.props.workspaceId,
      this.props.role,
      this.props.userId || null,
    ));
  }

  decline(): void {
    if (this.props.status !== 'pending') {
      return;
    }

    this.props.status = 'declined';
    this.props.updatedAt = new Date();

    this.addDomainEvent(new MemberDeclinedEvent(
      this.props.id,
      this.props.workspaceId,
      this.props.userId || null,
    ));
  }

  accept(userId: string): void {
    if (this.props.status !== 'pending') {
      return;
    }

    this.props.userId = userId;
    this.props.status = 'active';
    this.props.joinedAt = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new MemberAcceptedEvent(
      this.props.id,
      this.props.workspaceId,
      userId,
      this.props.role,
    ));
  }

  updateEmail(email: string): Result<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Result.err(new ValidationError('Invalid email format'));
    }

    this.props.email = email.toLowerCase().trim();
    this.props.updatedAt = new Date();

    return Result.ok();
  }
}

export class MemberJoinedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.member-joined';

  readonly type = MemberJoinedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly memberId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: Role;
  readonly email: string;

  constructor(
    memberId: string,
    workspaceId: string,
    userId: string,
    role: Role,
    email: string,
  ) {
    this.memberId = memberId;
    this.workspaceId = workspaceId;
    this.userId = userId;
    this.role = role;
    this.email = email;
    this.timestamp = new Date();
  }
}

export class MemberRoleChangedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.member-role-changed';

  readonly type = MemberRoleChangedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly memberId: string;
  readonly workspaceId: string;
  readonly previousRole: Role;
  readonly newRole: Role;
  readonly userId: string | null;

  constructor(
    memberId: string,
    workspaceId: string,
    previousRole: Role,
    newRole: Role,
    userId: string | null,
  ) {
    this.memberId = memberId;
    this.workspaceId = workspaceId;
    this.previousRole = previousRole;
    this.newRole = newRole;
    this.userId = userId;
    this.timestamp = new Date();
  }
}

export class MemberRemovedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.member-removed';

  readonly type = MemberRemovedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly memberId: string;
  readonly workspaceId: string;
  readonly role: Role;
  readonly userId: string | null;

  constructor(
    memberId: string,
    workspaceId: string,
    role: Role,
    userId: string | null,
  ) {
    this.memberId = memberId;
    this.workspaceId = workspaceId;
    this.role = role;
    this.userId = userId;
    this.timestamp = new Date();
  }
}

export class MemberDeclinedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.member-declined';

  readonly type = MemberDeclinedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly memberId: string;
  readonly workspaceId: string;
  readonly userId: string | null;

  constructor(
    memberId: string,
    workspaceId: string,
    userId: string | null,
  ) {
    this.memberId = memberId;
    this.workspaceId = workspaceId;
    this.userId = userId;
    this.timestamp = new Date();
  }
}

export class MemberAcceptedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.member-accepted';

  readonly type = MemberAcceptedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly memberId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: Role;

  constructor(
    memberId: string,
    workspaceId: string,
    userId: string,
    role: Role,
  ) {
    this.memberId = memberId;
    this.workspaceId = workspaceId;
    this.userId = userId;
    this.role = role;
    this.timestamp = new Date();
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}