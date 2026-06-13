/**
 * File:        apps/backend/src/core/application/use-cases/billing/get-current-subscription/get-current-subscription.spec.ts
 * Module:      Billing Use Cases
 * Purpose:     Tests for GetCurrentSubscription use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { GetCurrentSubscriptionHandler } from './get-current-subscription.handler';
import { GetCurrentSubscriptionCommand } from './get-current-subscription.command';
import { InMemorySubscriptionRepository } from '../../../../testing/in-memory-subscription.repository';

describe('GetCurrentSubscriptionHandler', () => {
  let handler: GetCurrentSubscriptionHandler;
  let subscriptionRepo: InMemorySubscriptionRepository;

  beforeEach(() => {
    subscriptionRepo = new InMemorySubscriptionRepository();
    handler = new GetCurrentSubscriptionHandler(subscriptionRepo as any);
  });

  it('should return subscription for user', async () => {
    await subscriptionRepo.save({ id: 's-1', workspaceId: 'ws-1', planId: 'p-1', planCode: 'PRO', status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() } as any);
    const result = await handler.execute(new GetCurrentSubscriptionCommand({ userId: 'ws-1' }));
    expect(result.isOk()).toBe(true);
  });

  it('should fail when not found', async () => {
    const result = await handler.execute(new GetCurrentSubscriptionCommand({ userId: 'nonexistent' }));
    expect(result.isErr()).toBe(true);
  });
});
