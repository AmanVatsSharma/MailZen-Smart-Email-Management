/**
 * File:        core/domain/bounded-contexts/scheduled-email/scheduled-email.aggregate.ts
 * Module:      Domain - Scheduled Email Bounded Context
 * Purpose:     Email scheduled for future send. Worker picks up and routes through
 *              messaging's send pipeline when scheduled time is reached.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result } from '../../shared/result';
import { EmailId, UserId, WorkspaceId } from '../../shared/value-objects/ids';

export type ScheduledEmailStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

export interface ScheduledEmailProps {
  id: string;
  emailId: EmailId;
  workspaceId: WorkspaceId;
  senderId: UserId;
  scheduledFor: Date;
  status: ScheduledEmailStatus;
  sentAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
}

export class ScheduledEmail extends AggregateRoot<ScheduledEmailProps> {
  get id(): string { return this.props.id; }
  get emailId(): EmailId { return this.props.emailId; }
  get workspaceId(): WorkspaceId { return this.props.workspaceId; }
  get senderId(): UserId { return this.props.senderId; }
  get scheduledFor(): Date { return this.props.scheduledFor; }
  get status(): ScheduledEmailStatus { return this.props.status; }

  private constructor(props: ScheduledEmailProps) {
    super(props);
  }

  static create(input: {
    emailId: EmailId;
    workspaceId: WorkspaceId;
    senderId: UserId;
    scheduledFor: Date;
  }): Result<ScheduledEmail, Error> {
    if (input.scheduledFor.getTime() <= Date.now()) {
      return Result.err(new Error('scheduledFor must be in the future'));
    }
    return Result.ok(new ScheduledEmail({
      id: crypto.randomUUID(),
      emailId: input.emailId,
      workspaceId: input.workspaceId,
      senderId: input.senderId,
      scheduledFor: input.scheduledFor,
      status: 'pending',
      sentAt: null,
      failureReason: null,
      createdAt: new Date(),
    }));
  }

  static reconstitute(props: ScheduledEmailProps): ScheduledEmail {
    return new ScheduledEmail(props);
  }

  markSent(): ScheduledEmail {
    return new ScheduledEmail({ ...this.props, status: 'sent', sentAt: new Date() });
  }

  cancel(): Result<ScheduledEmail, Error> {
    if (this.props.status === 'sent') {
      return Result.err(new Error('Cannot cancel an email that was already sent'));
    }
    return Result.ok(new ScheduledEmail({ ...this.props, status: 'cancelled' }));
  }

  markFailed(reason: string): ScheduledEmail {
    return new ScheduledEmail({ ...this.props, status: 'failed', failureReason: reason });
  }
}
