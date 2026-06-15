/**
 * File:        apps/backend/src/core/domain/bounded-contexts/ai/sender-intelligence.aggregate.ts
 * Module:      AI · Aggregate
 * Purpose:     SenderProfile aggregate. Captures historical behavior of a
 *              single sender (open/click/reply rates, avg reply time,
 *              trust score). Re-shape of `sender-intelligence.service`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';

export interface SenderProfileProps {
  id: string;
  emailAddress: string;
  workspaceId: string;
  totalReceived: number;
  totalReplied: number;
  averageReplyTimeMs: number;
  openRate: number;
  clickRate: number;
  lastInteractionAt: Date | null;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export class SenderProfileUpdatedEvent extends DomainEvent {
  readonly eventName = 'SenderProfileUpdated';
  constructor(
    public readonly senderProfileId: string,
    public readonly emailAddress: string,
    public readonly trustScore: number,
  ) {
    super({ occurredAt: new Date() });
  }
}

export class SenderProfile extends AggregateRoot<SenderProfileProps> {
  private constructor(props: SenderProfileProps) {
    super(props);
  }

  static create(input: {
    id: string;
    emailAddress: string;
    workspaceId: string;
  }): SenderProfile {
    const now = new Date();
    return new SenderProfile({
      id: input.id,
      emailAddress: input.emailAddress,
      workspaceId: input.workspaceId,
      totalReceived: 0,
      totalReplied: 0,
      averageReplyTimeMs: 0,
      openRate: 0,
      clickRate: 0,
      lastInteractionAt: null,
      trustScore: 0.5,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: SenderProfileProps): SenderProfile {
    return new SenderProfile(props);
  }

  get id(): string { return this.props.id; }
  get emailAddress(): string { return this.props.emailAddress; }
  get workspaceId(): string { return this.props.workspaceId; }
  get totalReceived(): number { return this.props.totalReceived; }
  get totalReplied(): number { return this.props.totalReplied; }
  get averageReplyTimeMs(): number { return this.props.averageReplyTimeMs; }
  get openRate(): number { return this.props.openRate; }
  get clickRate(): number { return this.props.clickRate; }
  get lastInteractionAt(): Date | null { return this.props.lastInteractionAt; }
  get trustScore(): number { return this.props.trustScore; }

  applyMetrics(input: {
    totalReceived: number;
    totalReplied: number;
    averageReplyTimeMs: number;
    openRate: number;
    clickRate: number;
    lastInteractionAt: Date | null;
    trustScore: number;
  }): void {
    if (input.trustScore < 0 || input.trustScore > 1) {
      throw new Error('trustScore must be in [0, 1]');
    }
    this.props.totalReceived = input.totalReceived;
    this.props.totalReplied = input.totalReplied;
    this.props.averageReplyTimeMs = input.averageReplyTimeMs;
    this.props.openRate = input.openRate;
    this.props.clickRate = input.clickRate;
    this.props.lastInteractionAt = input.lastInteractionAt;
    this.props.trustScore = input.trustScore;
    this.props.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new SenderProfileUpdatedEvent(
      this.props.id,
      this.props.emailAddress,
      this.props.trustScore,
    ));
  }
}
