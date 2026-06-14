/**
 * File:        apps/backend/src/core/application/use-cases/messaging/create-template/create-template.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the CreateTemplate use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface CreateTemplateInput {
  ownerUserId: string;
  name: string;
  subject: string;
  body: string;
}

export interface CreateTemplateOutput {
  id: string;
  name: string;
}
