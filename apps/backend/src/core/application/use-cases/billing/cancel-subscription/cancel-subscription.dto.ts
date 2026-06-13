/**
 * File:        apps/backend/src/core/application/use-cases/billing/cancel-subscription/cancel-subscription.dto.ts
 * Module:      Billing Use Cases
 * Purpose:     Data transfer object for CancelSubscription use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface CancelSubscriptionDto {
  userId: string;
  atPeriodEnd?: boolean;
}
