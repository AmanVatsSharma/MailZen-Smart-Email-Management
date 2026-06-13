// apps/backend/src/core/application/ports/event-bus/event-bus.ts
// Port: domain-event bus. Use cases publish here; infrastructure provides the impl.

import { DomainEvent } from '../../../domain/shared/domain-event';

export const EVENT_BUS = Symbol('IEventBus');

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: ReadonlyArray<DomainEvent>): Promise<void>;
  subscribe<T extends DomainEvent>(
    type: T['type'],
    handler: (event: T) => Promise<void> | void,
  ): void;
}
