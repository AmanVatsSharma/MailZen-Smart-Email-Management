/**
 * File:        apps/backend/src/core/application/use-cases/billing/list-plans/list-plans.handler.ts
 * Module:      Billing Use Cases
 * Purpose:     List all billing plans
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { PLAN_REPOSITORY, IPlanRepository } from '../../ports/repositories/plan.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { Plan } from '../../../../domain/bounded-contexts/billing/plan.aggregate';
import { ListPlansCommand } from './list-plans.command';

@Injectable()
export class ListPlansHandler {
  constructor(
    @Inject(PLAN_REPOSITORY) private planRepo: IPlanRepository,
  ) {}

  async execute(command: ListPlansCommand): Promise<Result<Plan[], ApplicationError>> {
    if (command.input.activeOnly !== false) {
      const plans = await this.planRepo.findAllActive();
      return Result.ok(plans);
    }
    const plans = await this.planRepo.findAll();
    return Result.ok(plans);
  }
}
