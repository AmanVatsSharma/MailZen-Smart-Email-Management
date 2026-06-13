/**
 * File:        apps/backend/src/core/application/use-cases/billing/change-plan/change-plan.spec.ts
 * Module:      Billing Use Cases
 * Purpose:     Tests for ChangePlan use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ChangePlanHandler } from './change-plan.handler';
import { ChangePlanCommand } from './change-plan.command';
import { InMemorySubscriptionRepository } from '../../../../testing/in-memory-subscription.repository';
import { InMemoryPlanRepository } from '../../../../testing/in-memory-plan.repository';

describe('ChangePlanHandler', () => {
  let handler: ChangePlanHandler;
  let subscriptionRepo: InMemorySubscriptionRepository;
  let planRepo: InMemoryPlanRepository;

  beforeEach(() => {
    subscriptionRepo = new InMemorySubscriptionRepository();
    planRepo = new InMemoryPlanRepository();
    handler = new ChangePlanHandler(subscriptionRepo as any, planRepo as any);
  });

  it('should change plan', async () => {
    await planRepo.save({ id: 'p-1', code: 'PRO', name: 'Pro', priceCents: 2500, currency: 'USD', features: [], monthlyAiCredits: 500, seats: 5, isActive: true } as any);
    await subscriptionRepo.save({ id: 's-1', workspaceId: 'ws-1', planId: 'p-0', planCode: 'FREE', status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() } as any);

    const result = await handler.execute(new ChangePlanCommand({ userId: 'ws-1', newPlanCode: 'PRO' }));
    expect(result.isOk()).toBe(true);
  });

  it('should fail when plan not found', async () => {
    await subscriptionRepo.save({ id: 's-1', workspaceId: 'ws-1', planId: 'p-0', planCode: 'FREE', status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() } as any);
    const result = await handler.execute(new ChangePlanCommand({ userId: 'ws-1', newPlanCode: 'NONEXISTENT' }));
    expect(result.isErr()).toBe(true);
  });
});
