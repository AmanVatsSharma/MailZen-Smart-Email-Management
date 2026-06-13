/**
 * File:        apps/backend/src/core/application/use-cases/billing/get-current-subscription/get-current-subscription.command.ts
 * Module:      Billing Use Cases
 * Purpose:     Command for GetCurrentSubscription use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { GetCurrentSubscriptionDto } from './get-current-subscription.dto';

export class GetCurrentSubscriptionCommand {
  constructor(public readonly input: GetCurrentSubscriptionDto) {}
}
