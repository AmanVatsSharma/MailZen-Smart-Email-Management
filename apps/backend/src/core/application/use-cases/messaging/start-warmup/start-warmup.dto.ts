/**
 * File:        apps/backend/src/core/application/use-cases/messaging/start-warmup/start-warmup.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the StartWarmup use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { WarmupConfig } from '../../../../../domain/bounded-contexts/messaging/warmup.aggregate';

export interface StartWarmupInput {
  providerId: string;
  config?: Partial<WarmupConfig>;
}

export interface StartWarmupOutput {
  id: string;
  status: string;
  currentDailyLimit: number;
}
