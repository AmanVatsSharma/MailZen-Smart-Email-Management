/**
 * File:        apps/backend/src/core/application/use-cases/messaging/get-email/get-email.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     GetEmail use case. Enforces workspace scope before returning
 *              the email aggregate.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { IEmailRepository, EMAIL_REPOSITORY } from '../../../ports/repositories/email.repository';
import { EmailId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { NotFoundError } from '../../../exceptions/application-error';
import { GetEmailInput, GetEmailOutput } from './get-email.dto';

export const GET_EMAIL_HANDLER = Symbol('GetEmailHandler');

export class GetEmailHandler {
  constructor(private readonly emails: IEmailRepository) {}

  async execute(input: GetEmailInput): Promise<Result<GetEmailOutput, Error>> {
    const found = await this.emails.findById(EmailId.from(input.id));
    if (!found) return makeResult(Result.err(new NotFoundError('Email')));
    // Workspace scope enforcement: the aggregate is loaded; verify scope.
    const ws = (found as unknown as { props: { workspaceId: WorkspaceId } }).props.workspaceId;
    if (ws !== WorkspaceId.from(input.workspaceId)) {
      return makeResult(Result.err(new NotFoundError('Email')));
    }
    return makeResult(Result.ok({
      id: found.id,
      subject: found.subject,
      status: found.status,
      threadId: found.threadId,
      from: found.from.toString(),
      to: found.recipients.map((r) => r.toString()),
      scheduledAt: found.scheduledAt,
      sentAt: (found as unknown as { props: { sentAt: Date | null } }).props.sentAt,
    }));
  }
}
