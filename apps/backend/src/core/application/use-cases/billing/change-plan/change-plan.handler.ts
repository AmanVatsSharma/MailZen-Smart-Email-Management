/**
 * File:        apps/backend/src/core/application/use-cases/billing/change-plan/change-plan.handler.ts
 * Module:      Billing Use Cases
 * Purpose:     Change the subscription plan
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { SUBSCRIPTION_REPOSITORY, ISubscriptionRepository } from '../../ports/repositories/subscription.repository';
import { PLAN_REPOSITORY, IPlanRepository } from '../../ports/repositories/plan.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { ChangePlanCommand } from './change-plan.command';

@Injectable()
export class ChangePlanHandler {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private subscriptionRepo: ISubscriptionRepository,
    @Inject(PLAN_REPOSITORY) private planRepo: IPlanRepository,
  ) {}

  async execute(command: ChangePlanCommand): Promise<Result<string, ApplicationError>> {
    if (!command.input.newPlanCode) {
      return Result.err(new ApplicationError('INVALID_PLAN', 'New plan code is required'));
    }

    const newPlan = await this.planRepo.findByCode(command.input.newPlanCode);
    if (!newPlan) {
      return Result.err(new ApplicationError('NOT_FOUND', `Plan '${command.input.newPlanCode}' not found`));
    }

    const subscription = await this.subscriptionRepo.findActiveForUserId(command.input.userId);
    if (!subscription) {
      return Result.err(new ApplicationError('NOT_FOUND', 'No active subscription'));
    }

    const changeResult = subscription.changePlan(newPlan.id, newPlan.code);
    if (changeResult.isErr()) {
      return Result.err(new ApplicationError('CHANGE_FAILED', changeResult.error.message));
    }

    const save = await this.subscriptionRepo.save(subscription);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    return Result.ok(subscription.id);
  }
}
