/**
 * File:        apps/backend/src/core/application/use-cases/contacts/add-tag/add-tag.dto.ts
 * Module:      Contacts Use Cases
 * Purpose:     Data transfer object for AddTag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface AddTagDto {
  contactId: string;
  tag: string;
}
