/**
 * File:        apps/backend/src/core/application/use-cases/contacts/create-contact/create-contact.dto.ts
 * Module:      Contacts Use Cases
 * Purpose:     Data transfer object for CreateContact use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface CreateContactDto {
  workspaceId: string;
  email: string;
  displayName: string;
  phone?: string;
  notes?: string;
  tags?: string[];
}
