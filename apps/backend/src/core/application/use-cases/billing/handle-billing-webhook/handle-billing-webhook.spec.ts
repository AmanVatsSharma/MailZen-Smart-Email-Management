/**
 * File:        apps/backend/src/core/application/use-cases/billing/handle-billing-webhook/handle-billing-webhook.spec.ts
 * Module:      Billing Use Cases
 * Purpose:     Tests for HandleBillingWebhook use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { HandleBillingWebhookHandler } from './handle-billing-webhook.handler';
import { HandleBillingWebhookCommand } from './handle-billing-webhook.command';
import { FakePaymentGateway } from '../../../../testing/fake-payment.gateway';
import { InMemorySubscriptionRepository } from '../../../../testing/in-memory-subscription.repository';

describe('HandleBillingWebhookHandler', () => {
  let handler: HandleBillingWebhookHandler;
  let paymentGateway: FakePaymentGateway;
  let subscriptionRepo: InMemorySubscriptionRepository;

  beforeEach(() => {
    paymentGateway = new FakePaymentGateway();
    subscriptionRepo = new InMemorySubscriptionRepository();
    handler = new HandleBillingWebhookHandler(paymentGateway as any, subscriptionRepo as any);
  });

  it('should handle stripe webhook', async () => {
    const result = await handler.execute(new HandleBillingWebhookCommand({
      provider: 'stripe',
      rawBody: Buffer.from('{}'),
      signature: 'sig',
    }));
    expect(result.isOk()).toBe(true);
  });
});
