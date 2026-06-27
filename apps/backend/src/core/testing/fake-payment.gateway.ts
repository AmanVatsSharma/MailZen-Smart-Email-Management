/**
 * File:        apps/backend/src/core/testing/fake-payment.gateway.ts
 * Module:      Testing Fakes
 * Purpose:     In-memory fake of IPaymentGateway for unit tests
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../domain/shared/result';
import {
  PaymentGateway,
  StripeCheckoutSession,
  RazorpayCheckoutSession,
} from '../application/ports/gateways/payment.gateway';

export class FakePaymentGateway implements PaymentGateway {
  public readonly createdSessions: Array<{ workspaceId: string; planCode: string }> = [];
  public readonly webhooksReceived: Array<{ provider: string; rawBody: Buffer; signature: string }> = [];

  createCheckoutSession(workspaceId: string, planCode: string): Result<StripeCheckoutSession | RazorpayCheckoutSession, Error> {
    this.createdSessions.push({ workspaceId, planCode });
    return Result.ok({
      sessionUrl: `https://fake-checkout.test/${workspaceId}/${planCode}`,
      sessionId: `cs_fake_${Date.now()}`,
    });
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean; eventType: string }> {
    this.webhooksReceived.push({ provider: 'stripe', rawBody, signature });
    return { received: true, eventType: 'invoice.paid' };
  }

  async handleRazorpayWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean; eventType: string }> {
    this.webhooksReceived.push({ provider: 'razorpay', rawBody, signature });
    return { received: true, eventType: 'subscription.charged' };
  }

  async processPaymentSuccess(_paymentData: { sessionId?: string; paymentId?: string }): Promise<void> {
    return;
  }
}
