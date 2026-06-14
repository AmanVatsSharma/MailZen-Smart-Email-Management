/**
 * File:        apps/backend/src/core/application/use-cases/messaging/delete-email/delete-email.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTOs for the DeleteEmail use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface DeleteEmailInput {
  id: string;
  workspaceId: string;
}

export interface DeleteEmailOutput {
  deleted: boolean;
}
