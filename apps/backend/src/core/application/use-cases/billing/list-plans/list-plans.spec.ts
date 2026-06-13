/**
 * File:        apps/backend/src/core/application/use-cases/billing/list-plans/list-plans.spec.ts
 * Module:      Billing Use Cases
 * Purpose:     Tests for ListPlans use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListPlansHandler } from './list-plans.handler';
import { ListPlansCommand } from './list-plans.command';
import { InMemoryPlanRepository } from '../../../../testing/in-memory-plan.repository';

describe('ListPlansHandler', () => {
  let handler: ListPlansHandler;
  let planRepo: InMemoryPlanRepository;

  beforeEach(() => {
    planRepo = new InMemoryPlanRepository();
    handler = new ListPlansHandler(planRepo as any);
  });

  it('should list all active plans by default', async () => {
    await planRepo.save({ id: 'p-1', code: 'FREE', name: 'Free', priceCents: 0, currency: 'USD', features: [], monthlyAiCredits: 50, seats: 1, isActive: true } as any);
    const result = await handler.execute(new ListPlansCommand({}));
    expect(result.isOk()).toBe(true);
    expect(result.value?.length).toBe(1);
  });
});
