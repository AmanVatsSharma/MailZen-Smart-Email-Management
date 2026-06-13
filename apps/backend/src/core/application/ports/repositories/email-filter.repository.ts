/**
 * File:        apps/backend/src/core/application/ports/repositories/email-filter.repository.ts
 * Module:      Core · Application · Ports
 * Purpose:     IEmailFilterRepository port. Persists user-defined email filter
 *              rules (rule definitions only — matching is pure via the
 *              EmailFilter specification).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailFilterRule } from '../../../domain/bounded-contexts/messaging/email-filter.specification';
import { UserId } from '../../../domain/shared/value-objects/ids';

export interface EmailFilterRecord {
  id: string;
  ownerUserId: UserId;
  name: string;
  rules: ReadonlyArray<EmailFilterRule>;
  createdAt: Date;
  updatedAt: Date;
}

export const EMAIL_FILTER_REPOSITORY = Symbol('IEmailFilterRepository');

export interface IEmailFilterRepository {
  save(record: EmailFilterRecord): Promise<void>;
  findById(id: string): Promise<EmailFilterRecord | null>;
  listByOwner(userId: UserId): Promise<EmailFilterRecord[]>;
  delete(id: string): Promise<void>;
}
