/**
 * File:        apps/backend/src/core/application/use-cases/billing/handle-billing-webhook/handle-billing-webhook.dto.ts
 * Module:      Billing Use Cases
 * Purpose:     Data transfer object for HandleBillingWebhook use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface HandleBillingWebhookDto {
  provider: 'stripe' | 'razorpay';
  rawBody: Buffer;
  signature: string;
}
