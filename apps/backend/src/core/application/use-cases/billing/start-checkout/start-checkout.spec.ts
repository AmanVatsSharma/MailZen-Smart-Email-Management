/**
 * File:        apps/backend/src/core/application/use-cases/billing/start-checkout/start-checkout.spec.ts
 * Module:      Billing Use Cases
 * Purpose:     Tests for StartCheckout use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { StartCheckoutHandler } from './start-checkout.handler';
import { StartCheckoutCommand } from './start-checkout.command';
import { FakePaymentGateway } from '../../../../testing/fake-payment.gateway';

describe('StartCheckoutHandler', () => {
  let handler: StartCheckoutHandler;
  let paymentGateway: FakePaymentGateway;

  beforeEach(() => {
    paymentGateway = new FakePaymentGateway();
    handler = new StartCheckoutHandler(paymentGateway as any);
  });

  it('should create checkout session', async () => {
    const result = await handler.execute(new StartCheckoutCommand({
      workspaceId: 'ws-1',
      planCode: 'PRO',
    }));
    expect(result.isOk()).toBe(true);
  });

  it('should fail when plan code missing', async () => {
    const result = await handler.execute(new StartCheckoutCommand({
      workspaceId: 'ws-1',
      planCode: '',
    }));
    expect(result.isErr()).toBe(true);
  });
});
