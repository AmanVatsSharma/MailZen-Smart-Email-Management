/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-templates/list-templates.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the ListTemplates use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface ListTemplatesInput {
  ownerUserId: string;
}

export interface ListTemplatesOutput {
  items: Array<{ id: string; name: string; subject: string; body: string }>;
}
