/**
 * File:        apps/backend/src/core/application/use-cases/contacts/merge-contacts/merge-contacts.dto.ts
 * Module:      Contacts Use Cases
 * Purpose:     Data transfer object for MergeContacts use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface MergeContactsDto {
  primaryContactId: string;
  duplicateContactId: string;
}
