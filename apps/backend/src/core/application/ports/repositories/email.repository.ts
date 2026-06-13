/**
 * File:        apps/backend/src/core/application/ports/repositories/email.repository.ts
 * Module:      Core · Application · Ports
 * Purpose:     IEmailRepository port. Adapter implementations live under
 *              core/infrastructure/persistence.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { Email, EmailStatus } from '../../../domain/bounded-contexts/messaging/email.aggregate';
import { EmailId, WorkspaceId, ThreadId } from '../../../domain/shared/value-objects/ids';

export const EMAIL_REPOSITORY = Symbol('IEmailRepository');

export interface EmailListFilter {
  workspaceId: WorkspaceId;
  status?: EmailStatus;
  threadId?: ThreadId;
  ownerUserId?: string;
  limit: number;
  offset: number;
}

export interface EmailListResult {
  items: Email[];
  total: number;
}

export interface IEmailRepository {
  save(email: Email): Promise<void>;
  findById(id: EmailId): Promise<Email | null>;
  list(filter: EmailListFilter): Promise<EmailListResult>;
  delete(id: EmailId): Promise<void>;
  findScheduledBefore(when: Date): Promise<Email[]>;
}
