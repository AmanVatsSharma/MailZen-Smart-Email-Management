/**
 * File:        apps/backend/src/core/application/use-cases/billing/start-checkout/start-checkout.dto.ts
 * Module:      Billing Use Cases
 * Purpose:     Data transfer object for StartCheckout use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface StartCheckoutDto {
  workspaceId: string;
  planCode: string;
  successUrl?: string;
  cancelUrl?: string;
}
