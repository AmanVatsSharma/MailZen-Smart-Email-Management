/**
 * File:        apps/backend/src/core/domain/shared/aggregate-root.ts
 * Module:      Domain Shared
 * Purpose:     Base class for aggregates. Owns identity and a list of pending domain events.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { DomainEvent } from './domain-event';

export abstract class AggregateRoot<TProps> {
  /**
   * Public props bag. Made public (not protected) so that repository mappers
   * outside the domain layer can read aggregate state. Domain logic inside
   * the aggregate should still mutate state via the aggregate's own methods
   * (rename, transferOwnership, …) — direct mutation of `props` is a smell.
   */
  readonly props: TProps;
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;

  protected constructor(props: TProps) {
    this.props = props;
  }

  get id(): string {
    return (this.props as unknown as { id: string }).id;
  }

  /** Expose workspaceId for handlers */
  get workspaceId(): string {
    return (this.props as unknown as { workspaceId: string }).workspaceId;
  }

  /** Expose email for handlers */
  get email(): string {
    return (this.props as unknown as { email: string }).email;
  }

  /** Expose tags for handlers */
  get tags(): string[] {
    return (this.props as unknown as { tags: string[] }).tags;
  }

  /** Expose name for handlers */
  get name(): string {
    return (this.props as unknown as { name: string }).name;
  }

  /** Expose role for handlers */
  get role(): string {
    return (this.props as unknown as { role: string }).role;
  }

  /** Expose status for handlers */
  get status(): string {
    return (this.props as unknown as { status: string }).status;
  }

  /** Expose createdAt for handlers */
  get createdAt(): Date {
    return (this.props as unknown as { createdAt: Date }).createdAt;
  }

  /** Expose updatedAt for handlers */
  get updatedAt(): Date {
    return (this.props as unknown as { updatedAt: Date }).updatedAt;
  }

  /** Expose notes for handlers */
  get notes(): string | null {
    return (this.props as unknown as { notes?: string | null }).notes || null;
  }

  /** Expose phone for handlers */
  get phone(): string | null {
    return (this.props as unknown as { phone?: string | null }).phone || null;
  }

  /** Expose code for handlers */
  get code(): string {
    return (this.props as unknown as { code: string }).code;
  }

  /** Expose userId for handlers */
  get userId(): string {
    return (this.props as unknown as { userId: string }).userId;
  }

  /** Expose ownerUserId for handlers */
  get ownerUserId(): string {
    return (this.props as unknown as { ownerUserId: string }).ownerUserId;
  }

  /** Expose body for handlers */
  get body(): string {
    return (this.props as unknown as { body: string }).body;
  }

  /** Expose subject for handlers */
  get subject(): string {
    return (this.props as unknown as { subject: string }).subject;
  }

  /** Expose planId for handlers */
  get planId(): string {
    return (this.props as unknown as { planId: string }).planId;
  }

  get version(): number {
    return this._version;
  }

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  /** Pull events for dispatch; clears the internal buffer. */
  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  protected incrementVersion(): void {
    this._version += 1;
  }
}