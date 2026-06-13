/**
 * File:        apps/backend/src/core/application/use-cases/billing/get-current-subscription/get-current-subscription.handler.ts
 * Module:      Billing Use Cases
 * Purpose:     Get the current subscription for a user
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { SUBSCRIPTION_REPOSITORY, ISubscriptionRepository } from '../../ports/repositories/subscription.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { Subscription } from '../../../../domain/bounded-contexts/billing/subscription.aggregate';
import { GetCurrentSubscriptionCommand } from './get-current-subscription.command';

@Injectable()
export class GetCurrentSubscriptionHandler {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private subscriptionRepo: ISubscriptionRepository,
  ) {}

  async execute(command: GetCurrentSubscriptionCommand): Promise<Result<Subscription, ApplicationError>> {
    const subscription = await this.subscriptionRepo.findActiveForUserId(command.input.userId);
    if (!subscription) {
      return Result.err(new ApplicationError('NOT_FOUND', 'No active subscription found'));
    }
    return Result.ok(subscription);
  }
}
