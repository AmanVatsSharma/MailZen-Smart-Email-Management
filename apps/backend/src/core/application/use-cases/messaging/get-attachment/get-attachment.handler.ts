/**
 * File:        apps/backend/src/core/application/use-cases/messaging/get-attachment/get-attachment.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     GetAttachment use case. Returns a single attachment by id.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IAttachmentRepository,
  ATTACHMENT_REPOSITORY,
} from '../../../ports/repositories/attachment.repository';
import { Result, makeResult } from '../../../../domain/shared/result';
import { NotFoundError } from '../../../exceptions/application-error';
import { GetAttachmentInput, GetAttachmentOutput } from './get-attachment.dto';

export const GET_ATTACHMENT_HANDLER = Symbol('GetAttachmentHandler');

export class GetAttachmentHandler {
  constructor(private readonly attachments: IAttachmentRepository) {}

  async execute(input: GetAttachmentInput): Promise<Result<GetAttachmentOutput, Error>> {
    const a = await this.attachments.findById(input.id);
    if (!a) return makeResult(Result.err(new NotFoundError('Attachment')));
    return makeResult(Result.ok({
      id: a.id, emailId: a.emailId, filename: a.filename, contentType: a.contentType, size: a.size, storageKey: a.storageKey,
    }));
  }
}
