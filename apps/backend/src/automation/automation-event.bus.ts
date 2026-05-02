/**
 * File:        apps/backend/src/automation/automation-event.bus.ts
 * Module:      Automation Engine · Event Bus
 * Purpose:     In-process pub/sub for AutomationEvents. Publishers (gmail-sync, outlook-sync,
 *              email.service, assignment.service) call publish(); the dispatcher subscribes
 *              at module init. All processing is async-safe: publish() never throws.
 *
 * Exports:
 *   - AutomationEventBus  — Injectable NestJS service wrapping an RxJS Subject
 *
 * Depends on:
 *   - rxjs                — Subject, Subscription (already a transitive NestJS dep)
 *   - @mailzen/shared-types — AutomationEvent discriminated union
 *
 * Side-effects:
 *   - Holds an in-process Subject; no external I/O
 *   - Subject is completed on module destroy to avoid memory leaks
 *
 * Key invariants:
 *   - publish() is synchronous and never throws (errors are caught + logged)
 *   - Subscriber errors are isolated via catchError per subscriber, not per bus
 *   - Subscribers must call unsubscribe() or use takeUntil on destroy
 *
 * Read order:
 *   1. AutomationEventBus — the service class; publish() then subscribe()
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { AutomationEvent } from '@mailzen/shared-types';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class AutomationEventBus implements OnModuleDestroy {
  private readonly logger = new Logger(AutomationEventBus.name);
  private readonly subject = new Subject<AutomationEvent>();

  publish(event: AutomationEvent): void {
    try {
      this.subject.next(event);
    } catch (err: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'automation_bus_publish_error',
          triggerType: event.type,
          workspaceId: event.workspaceId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  subscribe(handler: (event: AutomationEvent) => void): Subscription {
    return this.subject.asObservable().subscribe({
      next: (e) => {
        try {
          handler(e);
        } catch (err: unknown) {
          this.logger.error(
            serializeStructuredLog({
              event: 'automation_bus_handler_error',
              triggerType: e.type,
              workspaceId: e.workspaceId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      },
    });
  }

  onModuleDestroy(): void {
    this.subject.complete();
  }
}
