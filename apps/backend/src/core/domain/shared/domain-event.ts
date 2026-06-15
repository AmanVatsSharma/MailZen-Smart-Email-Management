// apps/backend/src/core/domain/shared/domain-event.ts
// Base interface for all domain events. Pure, framework-free.

export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}
