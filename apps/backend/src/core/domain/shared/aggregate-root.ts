// apps/backend/src/core/domain/shared/aggregate-root.ts
// Base class for aggregates. Owns identity and a list of pending domain events.

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
