/**
 * File:        apps/backend/src/core/application/use-cases/messaging/unassign-email/unassign-email.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the UnassignEmail use case. Resolves the active
 *              assignment for an email.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface UnassignEmailInput {
  emailId: string;
}

export interface UnassignEmailOutput {
  resolved: boolean;
}
