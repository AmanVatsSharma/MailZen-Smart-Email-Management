/**
 * File:        core/domain/bounded-contexts/email-analytics/tracking-event.aggregate.ts
 * Module:      Domain - Email Analytics Bounded Context
 * Purpose:     Tracking event (open/click) for a sent email. Used for engagement scoring.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result } from '../../shared/result';

export type TrackingKind = 'open' | 'click' | 'bounce' | 'unsubscribe';

export interface TrackingEventProps {
  id: string;
  emailId: string;
  recipientEmail: string;
  kind: TrackingKind;
  linkUrl: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  occurredAt: Date;
}

export class TrackingEvent extends AggregateRoot<TrackingEventProps> {
  get id(): string { return this.props.id; }
  get emailId(): string { return this.props.emailId; }
  get kind(): TrackingKind { return this.props.kind; }
  get linkUrl(): string | null { return this.props.linkUrl; }
  get occurredAt(): Date { return this.props.occurredAt; }

  private constructor(props: TrackingEventProps) {
    super(props);
  }

  static record(input: {
    emailId: string;
    recipientEmail: string;
    kind: TrackingKind;
    linkUrl?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Result<TrackingEvent, Error> {
    if (!input.emailId) return Result.err(new Error('emailId is required'));
    if (!input.recipientEmail) return Result.err(new Error('recipientEmail is required'));
    return Result.ok(new TrackingEvent({
      id: crypto.randomUUID(),
      emailId: input.emailId,
      recipientEmail: input.recipientEmail.toLowerCase(),
      kind: input.kind,
      linkUrl: input.linkUrl ?? null,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      occurredAt: new Date(),
    }));
  }

  static reconstitute(props: TrackingEventProps): TrackingEvent {
    return new TrackingEvent(props);
  }
}
