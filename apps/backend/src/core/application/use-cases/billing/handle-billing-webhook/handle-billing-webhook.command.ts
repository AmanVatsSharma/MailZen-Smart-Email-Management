/**
 * File:        apps/backend/src/core/application/use-cases/billing/handle-billing-webhook/handle-billing-webhook.command.ts
 * Module:      Billing Use Cases
 * Purpose:     Command for HandleBillingWebhook use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { HandleBillingWebhookDto } from './handle-billing-webhook.dto';

export class HandleBillingWebhookCommand {
  constructor(public readonly input: HandleBillingWebhookDto) {}
}
