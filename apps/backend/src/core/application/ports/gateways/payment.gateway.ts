/**
 * File:        apps/backend/src/core/application/ports/gateways/payment.gateway.ts
 * Module:      Application Ports
 * Purpose:     Port for external payment processing
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../../../domain/shared/result';

export const PAYMENT_GATEWAY = Symbol('IPaymentGateway');

export interface StripeCheckoutSession {
  sessionUrl: string;
  sessionId: string;
}

export interface RazorpayCheckoutSession {
  checkoutUrl: string;
  subscriptionId: string;
  keyId: string;
}

export interface PaymentGateway {
  createCheckoutSession(workspaceId: string, planCode: string): Result<StripeCheckoutSession | RazorpayCheckoutSession, Error>;
  handleStripeWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean; eventType: string }>;
  handleRazorpayWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean; eventType: string }>;
  processPaymentSuccess(paymentData: { sessionId?: string; paymentId?: string }): Promise<void>;
}

export interface PaymentCheckoutInput {
  workspaceId: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeWebhookInput {
  rawBody: Buffer;
  signature: string;
}

export interface RazorpayWebhookInput {
  rawBody: Buffer;
  signature: string;
}