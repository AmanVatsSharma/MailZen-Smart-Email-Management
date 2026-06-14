/**
 * File:        apps/backend/src/core/application/use-cases/messaging/assign-email/assign-email.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the AssignEmail use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface AssignEmailInput {
  emailId: string;
  workspaceId: string;
  assigneeUserId: string;
  assignerUserId: string;
  notes?: string;
  dueAt?: Date;
}

export interface AssignEmailOutput {
  id: string;
  status: string;
  assignedToUserId: string;
}
