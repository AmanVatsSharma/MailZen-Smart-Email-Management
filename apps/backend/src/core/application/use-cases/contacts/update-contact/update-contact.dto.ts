/**
 * File:        apps/backend/src/core/application/use-cases/contacts/update-contact/update-contact.dto.ts
 * Module:      Contacts Use Cases
 * Purpose:     Data transfer object for UpdateContact use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface UpdateContactDto {
  contactId: string;
  displayName?: string;
  phone?: string | null;
  notes?: string | null;
}
