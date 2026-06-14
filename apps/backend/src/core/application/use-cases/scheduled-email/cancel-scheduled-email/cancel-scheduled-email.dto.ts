/**
 * File:        apps/backend/src/core/application/use-cases/scheduled-email/cancel-scheduled-email/cancel-scheduled-email.dto.ts
 * Module:      Scheduled Email Use Cases
 * Purpose:     Data transfer object for CancelScheduledEmail use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface CancelScheduledEmailDto {
  id: string;
  workspaceId: string;
}
