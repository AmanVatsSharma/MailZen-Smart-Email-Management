/**
 * File:        apps/backend/src/core/domain/bounded-contexts/messaging/email-assignment.aggregate.ts
 * Module:      Core · Domain · Messaging
 * Purpose:     EmailAssignment aggregate. Assigns a thread (email) to a
 *              workspace member with a lifecycle: open → in_progress →
 *              resolved (terminal) or transferred (terminal, replaced by a new
 *              assignment row in the legacy semantics).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { AggregateRoot } from '../../shared/aggregate-root';
import { Result, makeResult } from '../../shared/result';
import { UserId, WorkspaceId, EmailId } from '../../shared/value-objects/ids';

export type EmailAssignmentStatus = 'open' | 'in_progress' | 'resolved' | 'transferred';

export interface EmailAssignmentProps {
  id: string;
  emailId: EmailId;
  workspaceId: WorkspaceId;
  assignedToUserId: UserId;
  assignedByUserId: UserId;
  notes: string | null;
  dueAt: Date | null;
  status: EmailAssignmentStatus;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailAssignment extends AggregateRoot<EmailAssignmentProps> {
  private constructor(props: EmailAssignmentProps) {
    super(props);
  }

  static assign(input: {
    id: string;
    emailId: EmailId;
    workspaceId: WorkspaceId;
    assigneeUserId: UserId;
    assignerUserId: UserId;
    notes?: string | null;
    dueAt?: Date | null;
  }): Result<EmailAssignment, Error> {
    if (!input.assigneeUserId) {
      return makeResult(Result.err(new Error('assigneeUserId is required')));
    }
    return makeResult(Result.ok(new EmailAssignment({
      id: input.id,
      emailId: input.emailId,
      workspaceId: input.workspaceId,
      assignedToUserId: input.assigneeUserId,
      assignedByUserId: input.assignerUserId,
      notes: input.notes ?? null,
      dueAt: input.dueAt ?? null,
      status: 'open',
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })));
  }

static reconstitute(props: EmailAssignmentProps): EmailAssignment { return EmailAssignment.rehydrate(props); }
  static rehydrate(emailassignmentprops: EmailAssignmentProps): EmailAssignment {
    return new EmailAssignment(props);
  }

  markInProgress(): void {
    if (this.props.status === 'open') {
      this.props.status = 'in_progress';
      this.props.updatedAt = new Date();
    }
  }

  resolve(): void {
    this.props.status = 'resolved';
    this.props.resolvedAt = new Date();
    this.props.updatedAt = new Date();
  }

  transfer(): void {
    this.props.status = 'transferred';
    this.props.updatedAt = new Date();
  }

  get status(): EmailAssignmentStatus { return this.props.status; }
  get assignedToUserId(): UserId { return this.props.assignedToUserId; }
}
