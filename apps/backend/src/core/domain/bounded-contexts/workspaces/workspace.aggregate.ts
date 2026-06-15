/**
 * File:        apps/backend/src/core/domain/bounded-contexts/workspaces/workspace.aggregate.ts
 * Module:      Workspace Domain
 * Purpose:     Workspace aggregate root with business logic and domain events
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';
import { Result, makeResult } from '../../shared/result';

export interface WorkspaceProps {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  isPersonal: boolean;
  automationsEnabled: boolean;
  automationConcurrencyCap: number;
  autoSendEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Workspace extends AggregateRoot<WorkspaceProps> {
  static create(props: Omit<WorkspaceProps, 'id' | 'createdAt' | 'updatedAt'>): Result<Workspace> {
    return Result.ok(
      new Workspace({
        ...props,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  rename(name: string): Result<void> {
    if (name.length < 2) {
      return Result.err(new ValidationError('Workspace name must be at least 2 characters'));
    }

    if (name.length > 80) {
      return Result.err(new ValidationError('Workspace name must be at most 80 characters'));
    }

    const previousName = this.props.name;
    this.props.name = name.trim();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new WorkspaceRenamedEvent(
      this.props.id,
      previousName,
      this.props.name,
    ));

    return Result.ok();
  }

  transferOwnership(newOwnerId: string): Result<void> {
    if (this.props.ownerUserId === newOwnerId) {
      return Result.err(new ValidationError('Cannot transfer ownership to the same user'));
    }

    const previousOwnerId = this.props.ownerUserId;
    this.props.ownerUserId = newOwnerId;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new WorkspaceOwnershipTransferredEvent(
      this.props.id,
      previousOwnerId,
      newOwnerId,
    ));

    return Result.ok();
  }

  archive(): void {
    this.props.updatedAt = new Date();
    this.addDomainEvent(new WorkspaceArchivedEvent(this.props.id));
  }

  unarchive(): void {
    this.props.updatedAt = new Date();
    this.addDomainEvent(new WorkspaceUnarchivedEvent(this.props.id));
  }

  updateConcurrencyCap(cap: number): Result<void> {
    if (cap < 1) {
      return Result.err(new ValidationError('Automation concurrency cap must be at least 1'));
    }

    if (cap > 100) {
      return Result.err(new ValidationError('Automation concurrency cap must be at most 100'));
    }

    this.props.automationConcurrencyCap = cap;
    this.props.updatedAt = new Date();

    return Result.ok();
  }

  enableAutoSend(): void {
    this.props.autoSendEnabled = true;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new WorkspaceAutoSendEnabledEvent(this.props.id));
  }

  disableAutoSend(): void {
    this.props.autoSendEnabled = false;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new WorkspaceAutoSendDisabledEvent(this.props.id));
  }

  enableAutomations(): void {
    this.props.automationsEnabled = true;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new WorkspaceAutomationsEnabledEvent(this.props.id));
  }

  disableAutomations(): void {
    this.props.automationsEnabled = false;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new WorkspaceAutomationsDisabledEvent(this.props.id));
  }
}

export class WorkspaceCreatedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.created';

  readonly type = WorkspaceCreatedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly ownerUserId: string;
  readonly isPersonal: boolean;

  constructor(
    workspaceId: string,
    workspaceName: string,
    ownerUserId: string,
    isPersonal: boolean,
  ) {
    this.workspaceId = workspaceId;
    this.workspaceName = workspaceName;
    this.ownerUserId = ownerUserId;
    this.isPersonal = isPersonal;
    this.timestamp = new Date();
  }
}

export class WorkspaceRenamedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.renamed';

  readonly type = WorkspaceRenamedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;
  readonly previousName: string;
  readonly newName: string;

  constructor(workspaceId: string, previousName: string, newName: string) {
    this.workspaceId = workspaceId;
    this.previousName = previousName;
    this.newName = newName;
    this.timestamp = new Date();
  }
}

export class WorkspaceOwnershipTransferredEvent implements DomainEvent {
  static readonly TYPE = 'workspace.ownership-transferred';

  readonly type = WorkspaceOwnershipTransferredEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;
  readonly previousOwnerId: string;
  readonly newOwnerId: string;

  constructor(workspaceId: string, previousOwnerId: string, newOwnerId: string) {
    this.workspaceId = workspaceId;
    this.previousOwnerId = previousOwnerId;
    this.newOwnerId = newOwnerId;
    this.timestamp = new Date();
  }
}

export class WorkspaceArchivedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.archived';

  readonly type = WorkspaceArchivedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.timestamp = new Date();
  }
}

export class WorkspaceUnarchivedEvent implements DomainEvent {
  static readonly TYPE = 'workspace.unarchived';

  readonly type = WorkspaceUnarchivedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.timestamp = new Date();
  }
}

export class WorkspaceAutoSendEnabledEvent implements DomainEvent {
  static readonly TYPE = 'workspace.auto-send-enabled';

  readonly type = WorkspaceAutoSendEnabledEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.timestamp = new Date();
  }
}

export class WorkspaceAutoSendDisabledEvent implements DomainEvent {
  static readonly TYPE = 'workspace.auto-send-disabled';

  readonly type = WorkspaceAutoSendDisabledEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.timestamp = new Date();
  }
}

export class WorkspaceAutomationsEnabledEvent implements DomainEvent {
  static readonly TYPE = 'workspace.automations-enabled';

  readonly type = WorkspaceAutomationsEnabledEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.timestamp = new Date();
  }
}

export class WorkspaceAutomationsDisabledEvent implements DomainEvent {
  static readonly TYPE = 'workspace.automations-disabled';

  readonly type = WorkspaceAutomationsDisabledEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.timestamp = new Date();
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}