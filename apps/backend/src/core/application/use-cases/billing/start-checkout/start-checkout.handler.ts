/**
 * File:        apps/backend/src/core/application/use-cases/billing/start-checkout/start-checkout.handler.ts
 * Module:      Billing Use Cases
 * Purpose:     Start a payment checkout session
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { PAYMENT_GATEWAY, PaymentGateway } from '../../ports/gateways/payment.gateway';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { StartCheckoutCommand } from './start-checkout.command';

@Injectable()
export class StartCheckoutHandler {
  constructor(
    @Inject(PAYMENT_GATEWAY) private paymentGateway: PaymentGateway,
  ) {}

  async execute(command: StartCheckoutCommand): Promise<Result<{ sessionUrl: string; sessionId: string }, ApplicationError>> {
    if (!command.input.planCode) {
      return Result.err(new ApplicationError('INVALID_PLAN', 'Plan code is required'));
    }

    const sessionResult = this.paymentGateway.createCheckoutSession(
      command.input.workspaceId,
      command.input.planCode,
    );

    if (sessionResult.isErr()) {
      return Result.err(new ApplicationError('CHECKOUT_FAILED', sessionResult.error.message));
    }

    const session = sessionResult.value;
    if ('sessionUrl' in session) {
      return Result.ok({ sessionUrl: session.sessionUrl, sessionId: session.sessionId });
    }
    return Result.ok({ sessionUrl: session.checkoutUrl, sessionId: session.subscriptionId });
  }
}
