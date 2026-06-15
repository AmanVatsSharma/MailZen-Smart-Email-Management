/**
 * File:        apps/backend/src/core/application/use-cases/messaging/assign-email/assign-email.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     AssignEmail use case. Creates a new EmailAssignment aggregate
 *              for the given email/workspace/assignee.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { randomUUID } from 'crypto';
import {
  IEmailAssignmentRepository,
  EMAIL_ASSIGNMENT_REPOSITORY,
} from '../../../ports/repositories/email-assignment.repository';
import { EmailAssignment } from '../../../../domain/bounded-contexts/messaging/email-assignment.aggregate';
import { EmailId, UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ValidationError } from '../../../exceptions/application-error';
import { AssignEmailInput, AssignEmailOutput } from './assign-email.dto';

export const ASSIGN_EMAIL_HANDLER = Symbol('AssignEmailHandler');

export class AssignEmailHandler {
  constructor(private readonly assignments: IEmailAssignmentRepository) {}

  async execute(input: AssignEmailInput): Promise<Result<AssignEmailOutput, Error>> {
    if (!input.assigneeUserId) {
      return makeResult(Result.err(new ValidationError('assigneeUserId is required', 'assigneeUserId')));
    }
    const created = EmailAssignment.assign({
      id: randomUUID(),
      emailId: EmailId.from(input.emailId),
      workspaceId: WorkspaceId.from(input.workspaceId),
      assigneeUserId: UserId.from(input.assigneeUserId),
      assignerUserId: UserId.from(input.assignerUserId),
      notes: input.notes ?? null,
      dueAt: input.dueAt ?? null,
    });
    if (!created.ok) return makeResult(Result.err(new ValidationError(created.error.message)));
    await this.assignments.save(created.value);
    return makeResult(Result.ok({
      id: created.value.id,
      status: created.value.status,
      assignedToUserId: input.assigneeUserId,
    }));
  }
}
