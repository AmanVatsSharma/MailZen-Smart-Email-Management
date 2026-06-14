/**
 * File:        apps/backend/src/core/application/use-cases/messaging/schedule-email/schedule-email.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTOs for the ScheduleEmail use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface ScheduleEmailInput {
  workspaceId: string;
  ownerUserId: string;
  from: string;
  to: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  scheduledAt: Date;
  threadId?: string;
}

export interface ScheduleEmailOutput {
  id: string;
  status: string;
  scheduledAt: Date;
}
