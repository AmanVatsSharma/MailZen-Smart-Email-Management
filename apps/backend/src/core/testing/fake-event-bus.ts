/**
 * File:        core/testing/fake-event-bus.ts
 * Module:      Testing
 * Purpose:     In-memory implementation of IEventBus for use case specs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { DomainEvent } from '../domain/shared/domain-event';
import { IEventBus } from 'application/ports/event-bus/event-bus';

export class FakeEventBus implements IEventBus {
  public events: DomainEvent[] = [];
  private subscribers: Map<string, Array<(event: DomainEvent) => Promise<void> | void>> = new Map();

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
    const handlers = this.subscribers.get(event.type) || [];
    for (const handler of handlers) {
      await handler(event);
    }
  }

  async publishAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  subscribe<T extends DomainEvent>(
    type: T['type'],
    handler: (event: T) => Promise<void> | void,
  ): void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, []);
    }
    this.subscribers.get(type)!.push(handler as (event: DomainEvent) => Promise<void> | void);
  }

  // Test helper
  clear(): void {
    this.events = [];
    this.subscribers.clear();
  }
}