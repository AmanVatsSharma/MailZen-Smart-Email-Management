/**
 * File:        apps/backend/src/core/application/use-cases/billing/cancel-subscription/cancel-subscription.command.ts
 * Module:      Billing Use Cases
 * Purpose:     Command for CancelSubscription use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { CancelSubscriptionDto } from './cancel-subscription.dto';

export class CancelSubscriptionCommand {
  constructor(public readonly input: CancelSubscriptionDto) {}
}
