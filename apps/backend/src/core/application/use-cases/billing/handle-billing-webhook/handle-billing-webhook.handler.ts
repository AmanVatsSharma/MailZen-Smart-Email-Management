/**
 * File:        apps/backend/src/core/application/use-cases/billing/handle-billing-webhook/handle-billing-webhook.handler.ts
 * Module:      Billing Use Cases
 * Purpose:     Handle incoming billing webhook events
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { PAYMENT_GATEWAY, PaymentGateway } from '../../../ports/gateways/payment.gateway';
import { SUBSCRIPTION_REPOSITORY, ISubscriptionRepository } from '../../../ports/repositories/subscription.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { HandleBillingWebhookCommand } from './handle-billing-webhook.command';

@Injectable()
export class HandleBillingWebhookHandler {
  constructor(
    @Inject(PAYMENT_GATEWAY) private paymentGateway: PaymentGateway,
    @Inject(SUBSCRIPTION_REPOSITORY) private subscriptionRepo: ISubscriptionRepository,
  ) {}

  async execute(command: HandleBillingWebhookCommand): Promise<Result<{ received: boolean; eventType: string }, ApplicationError>> {
    try {
      if (command.input.provider === 'stripe') {
        const result = await this.paymentGateway.handleStripeWebhook(
          command.input.rawBody,
          command.input.signature,
        );
        return Result.ok(result);
      } else {
        const result = await this.paymentGateway.handleRazorpayWebhook(
          command.input.rawBody,
          command.input.signature,
        );
        return Result.ok(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      return Result.err(new ApplicationError('WEBHOOK_FAILED', message));
    }
  }
}
