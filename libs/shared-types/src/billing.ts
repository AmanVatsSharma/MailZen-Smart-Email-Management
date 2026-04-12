/**
 * Billing plan identifiers used across frontend and backend.
 * Keep in sync with `BillingService.getDefaultPlans()`.
 */
export const BILLING_PLAN_IDS = ['FREE', 'PRO', 'BUSINESS'] as const;
export type BillingPlanId = (typeof BILLING_PLAN_IDS)[number];

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  /** Monthly price in USD cents */
  monthlyPriceCents: number;
  /** AI credits allocated per billing period */
  aiCredits: number;
  storageMb: number;
  maxWorkspaceMembers: number;
  maxMailboxes: number;
  features: string[];
}

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired';
