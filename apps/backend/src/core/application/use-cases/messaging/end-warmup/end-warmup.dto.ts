/**
 * File:        apps/backend/src/core/application/use-cases/messaging/end-warmup/end-warmup.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the EndWarmup use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface EndWarmupInput {
  warmupId: string;
}

export interface EndWarmupOutput {
  id: string;
  status: string;
}
