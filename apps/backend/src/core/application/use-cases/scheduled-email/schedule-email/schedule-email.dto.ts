/**
 * File:        apps/backend/src/core/application/use-cases/scheduled-email/schedule-email/schedule-email.dto.ts
 * Module:      Scheduled Email Use Cases
 * Purpose:     Data transfer object for ScheduleEmail use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ScheduleEmailDto {
  emailId: string;
  workspaceId: string;
  senderId: string;
  scheduledFor: Date;
}
