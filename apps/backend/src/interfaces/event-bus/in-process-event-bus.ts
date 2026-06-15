// apps/backend/src/interfaces/event-bus/in-process-event-bus.ts
// In-process event bus backed by RxJS. Adapter for IEventBus.

import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { IEventBus } from '../core/application/ports/event-bus/event-bus';
import { DomainEvent } from '../core/domain/shared/domain-event';

@Injectable()
export class InProcessEventBus implements IEventBus {
  private readonly logger = new Logger(InProcessEventBus.name);
  private readonly subject = new Subject<DomainEvent>();
  private readonly subscriptions = new Map<string, Array<(e: DomainEvent) => Promise<void> | void>>();

  async publish(event: DomainEvent): Promise<void> {
    this.subject.next(event);
  }

  async publishAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const e of events) {
      await this.publish(e);
    }
  }

  subscribe<T extends DomainEvent>(
    type: T['type'],
    handler: (event: T) => Promise<void> | void,
  ): void {
    const list = this.subscriptions.get(type) ?? [];
    list.push(handler as (e: DomainEvent) => Promise<void> | void);
    this.subscriptions.set(type, list);
  }

  /** For testing/diagnostic. */
  events$(type?: DomainEvent['type']): Observable<DomainEvent> {
    if (!type) return this.subject.asObservable();
    return this.subject.asObservable().pipe(filter(e => e.type === type));
  }
}
