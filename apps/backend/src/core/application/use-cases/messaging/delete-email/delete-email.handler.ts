/**
 * File:        apps/backend/src/core/application/use-cases/messaging/delete-email/delete-email.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DeleteEmail use case. Removes the email aggregate by id; the
 *              repository is responsible for cascading to attachments etc.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { IEmailRepository, EMAIL_REPOSITORY } from '../../../ports/repositories/email.repository';
import { EmailId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { NotFoundError } from '../../../exceptions/application-error';
import { DeleteEmailInput, DeleteEmailOutput } from './delete-email.dto';

export const DELETE_EMAIL_HANDLER = Symbol('DeleteEmailHandler');

export class DeleteEmailHandler {
  constructor(private readonly emails: IEmailRepository) {}

  async execute(input: DeleteEmailInput): Promise<Result<DeleteEmailOutput, Error>> {
    const found = await this.emails.findById(EmailId.from(input.id));
    if (!found) return makeResult(Result.err(new NotFoundError('Email')));
    const ws = (found as unknown as { props: { workspaceId: WorkspaceId } }).props.workspaceId;
    if (ws !== WorkspaceId.from(input.workspaceId)) {
      return makeResult(Result.err(new NotFoundError('Email')));
    }
    await this.emails.delete(EmailId.from(input.id));
    return makeResult(Result.ok({ deleted: true }));
  }
}
