/**
 * File:        apps/backend/src/core/application/use-cases/billing/change-plan/change-plan.dto.ts
 * Module:      Billing Use Cases
 * Purpose:     Data transfer object for ChangePlan use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ChangePlanDto {
  userId: string;
  newPlanCode: string;
}
