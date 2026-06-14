/**
 * File:        apps/backend/src/core/application/use-cases/messaging/record-warmup-activity/record-warmup-activity.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the RecordWarmupActivity use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface RecordWarmupActivityInput {
  warmupId: string;
  emailsSent: number;
  openRate: number;
}

export interface RecordWarmupActivityOutput {
  currentDailyLimit: number;
}
