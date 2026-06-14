/**
 * File:        apps/backend/src/core/application/use-cases/messaging/send-email/send-email.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTOs for the SendEmail use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface SendEmailInput {
  workspaceId: string;
  ownerUserId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  threadId?: string;
  providerId?: string;
}

export interface SendEmailOutput {
  id: string;
  status: string;
  providerMessageId: string;
}
