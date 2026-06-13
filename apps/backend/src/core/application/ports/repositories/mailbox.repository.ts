/**
 * File:        apps/backend/src/core/application/ports/repositories/mailbox.repository.ts
 * Module:      Application · Port
 * Purpose:     Mailbox repository port. Defines persistence operations
 *              for the Mailbox aggregate. Implementation will live in
 *              the infrastructure layer (TypeORM).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Mailbox } from '../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { ProviderType } from '../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

export interface IMailboxRepository {
  findById(id: string): Promise<Mailbox | null>;
  findByUserId(userId: string): Promise<Mailbox[]>;
  findByWorkspaceId(workspaceId: string): Promise<Mailbox[]>;
  findByEmailAddress(emailAddress: string): Promise<Mailbox | null>;
  findPrimaryByUserId(userId: string): Promise<Mailbox | null>;
  findByProvider(user: ProviderType, emailAddress: string): Promise<Mailbox | null>;
  save(mailbox: Mailbox): Promise<void>;
  delete(id: string): Promise<void>;
}

export const MAILBOX_REPOSITORY = Symbol('IMailboxRepository');
