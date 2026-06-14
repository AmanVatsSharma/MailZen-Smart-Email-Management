/**
 * File:        apps/backend/src/core/application/use-cases/messaging/get-email/get-email.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTOs for the GetEmail use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailStatus } from '../../../../domain/bounded-contexts/messaging/email.aggregate';

export interface GetEmailInput {
  id: string;
  workspaceId: string;
}

export interface GetEmailOutput {
  id: string;
  subject: string;
  status: EmailStatus;
  threadId: string | null;
  from: string;
  to: string[];
  scheduledAt: Date | null;
  sentAt: Date | null;
}
