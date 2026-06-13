/**
 * File:        apps/backend/src/core/application/ports/repositories/email-provider.repository.ts
 * Module:      Application · Port
 * Purpose:     EmailProvider repository port. Persistence operations
 *              for the EmailProvider aggregate (OAuth credentials, scopes).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { EmailProvider } from '../../../domain/bounded-contexts/mailbox/email-provider.aggregate';

export interface IEmailProviderRepository {
  findById(id: string): Promise<EmailProvider | null>;
  findByMailboxId(mailboxId: string): Promise<EmailProvider | null>;
  save(provider: EmailProvider): Promise<void>;
  delete(id: string): Promise<void>;
}

export const EMAIL_PROVIDER_REPOSITORY = Symbol('IEmailProviderRepository');
