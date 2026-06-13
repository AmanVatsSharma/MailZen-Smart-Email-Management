/**
 * File:        apps/backend/src/core/application/use-cases/billing/cancel-subscription/cancel-subscription.spec.ts
 * Module:      Billing Use Cases
 * Purpose:     Tests for CancelSubscription use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { CancelSubscriptionHandler } from './cancel-subscription.handler';
import { CancelSubscriptionCommand } from './cancel-subscription.command';
import { InMemorySubscriptionRepository } from '../../../../testing/in-memory-subscription.repository';

describe('CancelSubscriptionHandler', () => {
  let handler: CancelSubscriptionHandler;
  let subscriptionRepo: InMemorySubscriptionRepository;

  beforeEach(() => {
    subscriptionRepo = new InMemorySubscriptionRepository();
    handler = new CancelSubscriptionHandler(subscriptionRepo as any);
  });

  it('should cancel immediately by default', async () => {
    await subscriptionRepo.save({ id: 's-1', workspaceId: 'ws-1', planId: 'p-1', planCode: 'PRO', status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() } as any);
    const result = await handler.execute(new CancelSubscriptionCommand({ userId: 'ws-1' }));
    expect(result.isOk()).toBe(true);
  });

  it('should schedule cancellation when atPeriodEnd', async () => {
    await subscriptionRepo.save({ id: 's-1', workspaceId: 'ws-1', planId: 'p-1', planCode: 'PRO', status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() } as any);
    const result = await handler.execute(new CancelSubscriptionCommand({ userId: 'ws-1', atPeriodEnd: true }));
    expect(result.isOk()).toBe(true);
  });
});
