/**
 * File:        apps/backend/src/core/application/use-cases/billing/cancel-subscription/cancel-subscription.handler.ts
 * Module:      Billing Use Cases
 * Purpose:     Cancel a user's subscription
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { SUBSCRIPTION_REPOSITORY, ISubscriptionRepository } from '../../ports/repositories/subscription.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { CancelSubscriptionCommand } from './cancel-subscription.command';

@Injectable()
export class CancelSubscriptionHandler {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private subscriptionRepo: ISubscriptionRepository,
  ) {}

  async execute(command: CancelSubscriptionCommand): Promise<Result<string, ApplicationError>> {
    const subscription = await this.subscriptionRepo.findActiveForUserId(command.input.userId);
    if (!subscription) {
      return Result.err(new ApplicationError('NOT_FOUND', 'No active subscription'));
    }

    const result = command.input.atPeriodEnd
      ? subscription.scheduleCancellation()
      : subscription.cancel();

    if (result.isErr()) {
      return Result.err(new ApplicationError('CANCEL_FAILED', result.error.message));
    }

    const save = await this.subscriptionRepo.save(subscription);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    return Result.ok(subscription.id);
  }
}
