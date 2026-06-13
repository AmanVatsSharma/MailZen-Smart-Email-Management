/**
 * File:        apps/backend/src/core/application/ports/repositories/attachment.repository.ts
 * Module:      Core · Application · Ports
 * Purpose:     IAttachmentRepository port.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { Attachment } from '../../../domain/bounded-contexts/messaging/attachment.entity';
import { EmailId } from '../../../domain/shared/value-objects/ids';

export const ATTACHMENT_REPOSITORY = Symbol('IAttachmentRepository');

export interface IAttachmentRepository {
  save(attachment: Attachment): Promise<void>;
  findById(id: string): Promise<Attachment | null>;
  listByEmail(emailId: EmailId): Promise<Attachment[]>;
  delete(id: string): Promise<void>;
}
