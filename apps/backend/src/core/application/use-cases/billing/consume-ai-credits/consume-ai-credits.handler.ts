/**
 * File:        apps/backend/src/core/application/use-cases/billing/consume-ai-credits/consume-ai-credits.handler.ts
 * Module:      Billing Use Cases
 * Purpose:     Consume AI credits for a user
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { AI_CREDIT_BURNER, AiCreditBurner } from '../../../ports/gateways/ai-credit-burner.gateway';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { ConsumeAiCreditsCommand } from './consume-ai-credits.command';

@Injectable()
export class ConsumeAiCreditsHandler {
  constructor(
    @Inject(AI_CREDIT_BURNER) private creditBurner: AiCreditBurner,
  ) {}

  async execute(command: ConsumeAiCreditsCommand): Promise<Result<{ allowed: boolean; remainingCredits: number }, ApplicationError>> {
    const result = await this.creditBurner.consumeCredits({
      userId: command.input.userId,
      amount: command.input.amount,
      requestId: command.input.requestId,
      operation: command.input.operation || 'unknown',
    });

    if (result.isErr()) {
      return Result.err(new ApplicationError('CONSUME_FAILED', result.error.message));
    }

    return Result.ok({
      allowed: result.value.allowed,
      remainingCredits: result.value.remainingCredits,
    });
  }
}
