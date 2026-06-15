/**
 * File:        apps/backend/src/core/application/use-cases/messaging/unassign-email/unassign-email.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     UnassignEmail use case. Resolves the open/in_progress
 *              assignment for the given email.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailAssignmentRepository,
  EMAIL_ASSIGNMENT_REPOSITORY,
} from '../../../ports/repositories/email-assignment.repository';
import { EmailId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { NotFoundError } from '../../../exceptions/application-error';
import { UnassignEmailInput, UnassignEmailOutput } from './unassign-email.dto';

export const UNASSIGN_EMAIL_HANDLER = Symbol('UnassignEmailHandler');

export class UnassignEmailHandler {
  constructor(private readonly assignments: IEmailAssignmentRepository) {}

  async execute(input: UnassignEmailInput): Promise<Result<UnassignEmailOutput, Error>> {
    const open = await this.assignments.findOpenForEmail(EmailId.from(input.emailId));
    if (!open) return makeResult(Result.err(new NotFoundError('OpenAssignment')));
    open.resolve();
    await this.assignments.save(open);
    return makeResult(Result.ok({ resolved: true }));
  }
}
