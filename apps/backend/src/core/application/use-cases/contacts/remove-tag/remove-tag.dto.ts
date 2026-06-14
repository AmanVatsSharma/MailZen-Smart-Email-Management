/**
 * File:        apps/backend/src/core/application/use-cases/contacts/remove-tag/remove-tag.dto.ts
 * Module:      Contacts Use Cases
 * Purpose:     Data transfer object for RemoveTag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface RemoveTagDto {
  contactId: string;
  tag: string;
}
