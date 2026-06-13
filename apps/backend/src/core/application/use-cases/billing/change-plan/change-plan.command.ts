/**
 * File:        apps/backend/src/core/application/use-cases/billing/change-plan/change-plan.command.ts
 * Module:      Billing Use Cases
 * Purpose:     Command for ChangePlan use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ChangePlanDto } from './change-plan.dto';

export class ChangePlanCommand {
  constructor(public readonly input: ChangePlanDto) {}
}
