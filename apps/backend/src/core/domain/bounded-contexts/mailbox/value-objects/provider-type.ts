/**
 * File:        apps/backend/src/core/domain/bounded-contexts/mailbox/value-objects/provider-type.ts
 * Module:      Mailbox · Value Object
 * Purpose:     Enum of supported email providers. Mirrors the legacy
 *              `email-integration` provider discriminator. Used by both
 *              `Mailbox` and `EmailProvider` aggregates.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export enum ProviderType {
  GMAIL = 'GMAIL',
  OUTLOOK = 'OUTLOOK',
  IMAP = 'IMAP',
  SMTP = 'SMTP',
}

export const isProviderType = (raw: string): raw is ProviderType =>
  Object.values(ProviderType).includes(raw as ProviderType);
