/**
 * File:        apps/backend/src/core/application/ports/repositories/email-template.repository.ts
 * Module:      Core · Application · Ports
 * Purpose:     IEmailTemplateRepository port.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailTemplate } from '../../../domain/bounded-contexts/messaging/email-template.aggregate';
import { UserId } from '../../../domain/shared/value-objects/ids';

export const EMAIL_TEMPLATE_REPOSITORY = Symbol('IEmailTemplateRepository');

export interface IEmailTemplateRepository {
  save(template: EmailTemplate): Promise<void>;
  findById(id: string): Promise<EmailTemplate | null>;
  listByOwner(userId: UserId): Promise<EmailTemplate[]>;
  delete(id: string): Promise<void>;
}
