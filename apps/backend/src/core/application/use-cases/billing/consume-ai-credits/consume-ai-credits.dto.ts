/**
 * File:        apps/backend/src/core/application/use-cases/billing/consume-ai-credits/consume-ai-credits.dto.ts
 * Module:      Billing Use Cases
 * Purpose:     Data transfer object for ConsumeAiCredits use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ConsumeAiCreditsDto {
  userId: string;
  amount: number;
  requestId?: string;
  operation?: string;
}
