/**
 * File:        apps/backend/src/core/application/use-cases/billing/list-plans/list-plans.command.ts
 * Module:      Billing Use Cases
 * Purpose:     Command for ListPlans use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListPlansDto } from './list-plans.dto';

export class ListPlansCommand {
  constructor(public readonly input: ListPlansDto) {}
}
