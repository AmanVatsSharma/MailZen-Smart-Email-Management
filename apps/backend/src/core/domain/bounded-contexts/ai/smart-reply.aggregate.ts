/**
 * File:        apps/backend/src/core/domain/bounded-contexts/ai/smart-reply.aggregate.ts
 * Module:      AI · Aggregate
 * Purpose:     SmartReply aggregate. Holds a list of AI-generated reply
 *              suggestions for a single email. Tracks which suggestion
 *              the user has accepted or rejected. Behavior-preserving
 *              re-shape of `SmartReplyHistory`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';

export interface SmartReplySuggestion {
  text: string;
  score: number;
}

export interface SmartReplyProps {
  id: string;
  emailId: string;
  workspaceId: string;
  userId: string;
  suggestions: SmartReplySuggestion[];
  acceptedIndex: number | null;
  rejectedIndices: number[];
  tone: string | null;
  createdAt: Date;
}

export class SmartReplyAcceptedEvent extends DomainEvent {
  readonly eventName = 'SmartReplyAccepted';
  constructor(
    public readonly smartReplyId: string,
    public readonly emailId: string,
    public readonly index: number,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class SmartReplyRejectedEvent extends DomainEvent {
  readonly eventName = 'SmartReplyRejected';
  constructor(
    public readonly smartReplyId: string,
    public readonly emailId: string,
    public readonly index: number,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class SmartReply extends AggregateRoot<SmartReplyProps> {
  private constructor(props: SmartReplyProps) {
    super(props);
  }

  static create(input: {
    id: string;
    emailId: string;
    workspaceId: string;
    userId: string;
    suggestions: SmartReplySuggestion[];
    tone?: string;
  }): SmartReply {
    return new SmartReply({
      id: input.id,
      emailId: input.emailId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      suggestions: input.suggestions,
      acceptedIndex: null,
      rejectedIndices: [],
      tone: input.tone ?? null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: SmartReplyProps): SmartReply {
    return new SmartReply(props);
  }

  get id(): string { return this.props.id; }
  get emailId(): string { return this.props.emailId; }
  get workspaceId(): string { return this.props.workspaceId; }
  get userId(): string { return this.props.userId; }
  get suggestions(): ReadonlyArray<SmartReplySuggestion> { return this.props.suggestions; }
  get acceptedIndex(): number | null { return this.props.acceptedIndex; }
  get rejectedIndices(): ReadonlyArray<number> { return this.props.rejectedIndices; }
  get tone(): string | null { return this.props.tone; }
  get createdAt(): Date { return this.props.createdAt; }

  accept(index: number): void {
    if (index < 0 || index >= this.props.suggestions.length) {
      throw new Error(`Invalid suggestion index: ${index}`);
    }
    if (this.props.acceptedIndex === index) return;
    this.props.acceptedIndex = index;
    this.incrementVersion();
    this.addDomainEvent(new SmartReplyAcceptedEvent(
      this.props.id,
      this.props.emailId,
      index,
    ));
  }

  reject(index: number): void {
    if (index < 0 || index >= this.props.suggestions.length) {
      throw new Error(`Invalid suggestion index: ${index}`);
    }
    if (this.props.rejectedIndices.includes(index)) return;
    this.props.rejectedIndices.push(index);
    this.incrementVersion();
    this.addDomainEvent(new SmartReplyRejectedEvent(
      this.props.id,
      this.props.emailId,
      index,
    ));
  }
}
