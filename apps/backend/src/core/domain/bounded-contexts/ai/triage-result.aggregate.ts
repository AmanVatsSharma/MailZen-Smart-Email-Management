/**
 * File:        apps/backend/src/core/domain/bounded-contexts/ai/triage-result.aggregate.ts
 * Module:      AI · Aggregate
 * Purpose:     TriageResult aggregate. Represents AI classification and
 *              prioritization of a single email thread. Preserves from
 *              `inbox-ai.service`: priority, category, reasoning, actions.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';

export enum TriagePriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export enum TriageCategory {
  WORK = 'WORK',
  PERSONAL = 'PERSONAL',
  NEWSLETTER = 'NEWSLETTER',
  SPAM = 'SPAM',
  PROMOTION = 'PROMOTION',
}

export interface SuggestedAction {
  type: string;
  description: string;
}

export interface TriageResultProps {
  id: string;
  emailId: string;
  workspaceId: string;
  userId: string;
  priority: TriagePriority;
  category: TriageCategory;
  reasoning: string;
  suggestedActions: SuggestedAction[];
  createdAt: Date;
}

export class TriageResultCreatedEvent extends DomainEvent {
  readonly eventName = 'TriageResultCreated';
  constructor(
    public readonly triageResultId: string,
    public readonly emailId: string,
    public readonly priority: TriagePriority,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class TriageResult extends AggregateRoot<TriageResultProps> {
  private constructor(props: TriageResultProps) {
    super(props);
  }

  static create(input: {
    id: string;
    emailId: string;
    workspaceId: string;
    userId: string;
    priority: TriagePriority;
    category: TriageCategory;
    reasoning: string;
    suggestedActions: SuggestedAction[];
  }): TriageResult {
    return new TriageResult({
      id: input.id,
      emailId: input.emailId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      priority: input.priority,
      category: input.category,
      reasoning: input.reasoning,
      suggestedActions: input.suggestedActions,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: TriageResultProps): TriageResult {
    return new TriageResult(props);
  }

  get id(): string { return this.props.id; }
  get emailId(): string { return this.props.emailId; }
  get workspaceId(): string { return this.props.workspaceId; }
  get userId(): string { return this.props.userId; }
  get priority(): TriagePriority { return this.props.priority; }
  get category(): TriageCategory { return this.props.category; }
  get reasoning(): string { return this.props.reasoning; }
  get suggestedActions(): ReadonlyArray<SuggestedAction> { return this.props.suggestedActions; }
  get createdAt(): Date { return this.props.createdAt; }
}
