/**
 * File:        apps/backend/src/core/domain/bounded-contexts/messaging/email.aggregate.ts
 * Module:      Core · Domain · Messaging
 * Purpose:     Email aggregate root. Models an outbound/inbound message and its
 *              lifecycle (Draft → Scheduled → Sending → Sent/Failed/Bounced).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { AggregateRoot } from '../../shared/aggregate-root';
import { Result, makeResult } from '../../shared/result';
import { EmailAddress } from '../../shared/value-objects/email-address';
import { EmailId, UserId, WorkspaceId, ThreadId } from '../../shared/value-objects/ids';
import { DomainEvent } from '../../shared/domain-event';

export enum EmailStatus {
  Draft = 'DRAFT',
  Scheduled = 'SCHEDULED',
  Sending = 'SENDING',
  Sent = 'SENT',
  Failed = 'FAILED',
  Bounced = 'BOUNCED',
}

export class EmailScheduledEvent implements DomainEvent {
  readonly type = 'messaging.email.scheduled';
  readonly occurredAt: Date;
  readonly aggregateId: string;
  constructor(public readonly emailId: string, public readonly scheduledAt: Date) {
    this.aggregateId = emailId;
    this.occurredAt = new Date();
  }
}

export class EmailSentEvent implements DomainEvent {
  readonly type = 'messaging.email.sent';
  readonly occurredAt: Date;
  readonly aggregateId: string;
  constructor(public readonly emailId: string, public readonly sentAt: Date) {
    this.aggregateId = emailId;
    this.occurredAt = new Date();
  }
}

export class EmailFailedEvent implements DomainEvent {
  readonly type = 'messaging.email.failed';
  readonly occurredAt: Date;
  readonly aggregateId: string;
  constructor(public readonly emailId: string, public readonly reason: string) {
    this.aggregateId = emailId;
    this.occurredAt = new Date();
  }
}

export class EmailBouncedEvent implements DomainEvent {
  readonly type = 'messaging.email.bounced';
  readonly occurredAt: Date;
  readonly aggregateId: string;
  constructor(public readonly emailId: string, public readonly reason: string) {
    this.aggregateId = emailId;
    this.occurredAt = new Date();
  }
}

export interface EmailProps {
  id: EmailId;
  workspaceId: WorkspaceId;
  ownerUserId: UserId;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: EmailStatus;
  threadId: ThreadId | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  failureReason: string | null;
  bounceReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Email extends AggregateRoot<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(input: {
    id: EmailId;
    workspaceId: WorkspaceId;
    ownerUserId: UserId;
    from: EmailAddress;
    to: EmailAddress[];
    subject: string;
    bodyHtml: string;
    bodyText: string;
    threadId?: ThreadId | null;
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
  }): Result<Email, Error> {
    if (input.subject.trim().length === 0) {
      return makeResult(Result.err(new Error('subject is required')));
    }
    if (input.to.length === 0) {
      return makeResult(Result.err(new Error('at least one recipient is required')));
    }
    const email = new Email({
      id: input.id,
      workspaceId: input.workspaceId,
      ownerUserId: input.ownerUserId,
      from: input.from,
      to: input.to,
      cc: input.cc ?? [],
      bcc: input.bcc ?? [],
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      status: EmailStatus.Draft,
      threadId: input.threadId ?? null,
      scheduledAt: null,
      sentAt: null,
      failureReason: null,
      bounceReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return makeResult(Result.ok(email));
  }

static reconstitute(props: EmailProps): Email { return Email.rehydrate(props); }
  static rehydrate(emailprops: EmailProps): Email {
    return new Email(props);
  }

  schedule(at: Date): Result<void, Error> {
    if (at.getTime() <= Date.now()) {
      return makeResult(Result.err(new Error('scheduledAt must be in the future')));
    }
    this.props.status = EmailStatus.Scheduled;
    this.props.scheduledAt = at;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new EmailScheduledEvent(this.props.id, at));
    return makeResult(Result.ok(undefined));
  }

  markSending(): void {
    this.props.status = EmailStatus.Sending;
    this.props.updatedAt = new Date();
  }

  markSent(at: Date): void {
    this.props.status = EmailStatus.Sent;
    this.props.sentAt = at;
    this.props.scheduledAt = null;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new EmailSentEvent(this.props.id, at));
  }

  markFailed(reason: string): void {
    this.props.status = EmailStatus.Failed;
    this.props.failureReason = reason;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new EmailFailedEvent(this.props.id, reason));
  }

  markBounced(reason: string): void {
    this.props.status = EmailStatus.Bounced;
    this.props.bounceReason = reason;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new EmailBouncedEvent(this.props.id, reason));
  }

  get status(): EmailStatus { return this.props.status; }
  get subject(): string { return this.props.subject; }
  get bodyHtml(): string { return this.props.bodyHtml; }
  get bodyText(): string { return this.props.bodyText; }
  get from(): EmailAddress { return this.props.from; }
  get toRecipients(): EmailAddress[] { return [...this.props.to]; }
  get ccRecipients(): EmailAddress[] { return [...this.props.cc]; }
  get bccRecipients(): EmailAddress[] { return [...this.props.bcc]; }
  get recipients(): EmailAddress[] { return [...this.props.to, ...this.props.cc, ...this.props.bcc]; }
  get threadId(): ThreadId | null { return this.props.threadId; }
  get scheduledAt(): Date | null { return this.props.scheduledAt; }
}
