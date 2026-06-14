/**
 * File:        apps/backend/src/core/application/use-cases/contacts/list-contacts/list-contacts.dto.ts
 * Module:      Contacts Use Cases
 * Purpose:     Data transfer object for ListContacts use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ListContactsDto {
  workspaceId: string;
  tag?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}
