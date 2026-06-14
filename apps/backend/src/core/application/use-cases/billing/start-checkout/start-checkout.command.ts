/**
 * File:        apps/backend/src/core/application/use-cases/billing/start-checkout/start-checkout.command.ts
 * Module:      Billing Use Cases
 * Purpose:     Command for StartCheckout use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { StartCheckoutDto } from './start-checkout.dto';

export class StartCheckoutCommand {
  constructor(public readonly input: StartCheckoutDto) {}
}
