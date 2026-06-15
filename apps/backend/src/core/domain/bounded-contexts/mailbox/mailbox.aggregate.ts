/**
 * File:        apps/backend/src/core/domain/bounded-contexts/mailbox/mailbox.aggregate.ts
 * Module:      Mailbox · Aggregate
 * Purpose:     Mailbox aggregate root. Represents a user-owned mailbox
 *              bound to a specific email provider. Holds sync state and
 *              emits domain events for connection and sync transitions.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';
import { ProviderType } from './value-objects/provider-type';

export interface MailboxProps {
  id: string;
  workspaceId: string;
  userId: string;
  provider: ProviderType;
  emailAddress: string;
  isPrimary: boolean;
  isConnected: boolean;
  lastSyncedAt: Date | null;
  syncCursor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MailboxConnectedEvent extends DomainEvent {
  readonly eventName = 'MailboxConnected';
  constructor(
    public readonly mailboxId: string,
    public readonly userId: string,
    public readonly provider: ProviderType,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class MailboxDisconnectedEvent extends DomainEvent {
  readonly eventName = 'MailboxDisconnected';
  constructor(
    public readonly mailboxId: string,
    public readonly userId: string,
    public readonly provider: ProviderType,
    public readonly reason: string,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class MailboxSyncCursorUpdatedEvent extends DomainEvent {
  readonly eventName = 'MailboxSyncCursorUpdated';
  constructor(
    public readonly mailboxId: string,
    public readonly cursor: string,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class MailboxSetPrimaryEvent extends DomainEvent {
  readonly eventName = 'MailboxSetPrimary';
  constructor(
    public readonly mailboxId: string,
    public readonly userId: string,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class Mailbox extends AggregateRoot<MailboxProps> {
  private constructor(props: MailboxProps) {
    super(props);
  }

  static create(input: {
    id: string;
    workspaceId: string;
    userId: string;
    provider: ProviderType;
    emailAddress: string;
  }): Mailbox {
    const now = new Date();
    const mailbox = new Mailbox({
      id: input.id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: input.provider,
      emailAddress: input.emailAddress,
      isPrimary: false,
      isConnected: false,
      lastSyncedAt: null,
      syncCursor: null,
      createdAt: now,
      updatedAt: now,
    });
    mailbox.incrementVersion();
    return mailbox;
  }

  static reconstitute(props: MailboxProps): Mailbox {
    return new Mailbox(props);
  }

  get id(): string { return this.props.id; }
  get workspaceId(): string { return this.props.workspaceId; }
  get userId(): string { return this.props.userId; }
  get provider(): ProviderType { return this.props.provider; }
  get emailAddress(): string { return this.props.emailAddress; }
  get isPrimary(): boolean { return this.props.isPrimary; }
  get isConnected(): boolean { return this.props.isConnected; }
  get lastSyncedAt(): Date | null { return this.props.lastSyncedAt; }
  get syncCursor(): string | null { return this.props.syncCursor; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  markConnected(): void {
    if (this.props.isConnected) return;
    this.props.isConnected = true;
    this.props.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new MailboxConnectedEvent(
      this.props.id,
      this.props.userId,
      this.props.provider,
    ));
  }

  markDisconnected(reason: string): void {
    if (!this.props.isConnected) return;
    this.props.isConnected = false;
    this.props.syncCursor = null;
    this.props.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new MailboxDisconnectedEvent(
      this.props.id,
      this.props.userId,
      this.props.provider,
      reason,
    ));
  }

  updateSyncCursor(cursor: string): void {
    if (cursor === this.props.syncCursor) return;
    this.props.syncCursor = cursor;
    this.props.lastSyncedAt = new Date();
    this.props.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new MailboxSyncCursorUpdatedEvent(this.props.id, cursor));
  }

  markPrimary(): void {
    if (this.props.isPrimary) return;
    this.props.isPrimary = true;
    this.props.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new MailboxSetPrimaryEvent(this.props.id, this.props.userId));
  }

  unmarkPrimary(): void {
    if (!this.props.isPrimary) return;
    this.props.isPrimary = false;
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
