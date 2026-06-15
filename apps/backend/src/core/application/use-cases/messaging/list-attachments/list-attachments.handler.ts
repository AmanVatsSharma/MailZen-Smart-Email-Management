/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-attachments/list-attachments.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     ListAttachments use case. Returns all attachments for an
 *              email.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IAttachmentRepository,
  ATTACHMENT_REPOSITORY,
} from '../../../ports/repositories/attachment.repository';
import { EmailId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ListAttachmentsInput, ListAttachmentsOutput } from './list-attachments.dto';

export const LIST_ATTACHMENTS_HANDLER = Symbol('ListAttachmentsHandler');

export class ListAttachmentsHandler {
  constructor(private readonly attachments: IAttachmentRepository) {}

  async execute(input: ListAttachmentsInput): Promise<Result<ListAttachmentsOutput, Error>> {
    const list = await this.attachments.listByEmail(EmailId.from(input.emailId));
    return makeResult(Result.ok({
      items: list.map((a) => ({
        id: a.id, filename: a.filename, contentType: a.contentType, size: a.size, storageKey: a.storageKey,
      })),
    }));
  }
}
