/**
 * File:        apps/backend/src/core/application/use-cases/ai/list-ai-usage/list-ai-usage.handler.ts
 * Module:      AI · Use Case
 * Purpose:     List AI usage across the bounded contexts. Aggregates
 *              historical usage for billing integration. Returns empty
 *              VO if no usage yet.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { AiUsage } from '../../../../domain/bounded-contexts/ai/value-objects/ai-usage.value-object';
import { SMART_REPLY_REPOSITORY, ISmartReplyRepository } from '../../../ports/repositories/smart-reply.repository';
import { TRIAGE_RESULT_REPOSITORY, ITriageResultRepository } from '../../../ports/repositories/triage-result.repository';

export interface ListAiUsageInput {
  userId: string;
  workspaceId?: string;
  month?: string;
}

@Injectable()
export class ListAiUsageHandler {
  constructor(
    @Inject(SMART_REPLY_REPOSITORY)
    private readonly replyRepo: ISmartReplyRepository,
    @Inject(TRIAGE_RESULT_REPOSITORY)
    private readonly triageRepo: ITriageResultRepository,
  ) {}

  async execute(
    input: ListAiUsageInput,
  ): Promise<Result<AiUsage, never>> {
    const smartReplies = await this.replyRepo.findByUserId(input.userId, 1000);
    const triageResults = await this.triageRepo.findByUserId(input.userId);

    const totalSmartReplies = smartReplies.length;
    const totalTriageResults = triageResults.length;
    const totalOperations = totalSmartReplies + totalTriageResults;

    return makeResult(Result.ok(new AiUsage({
      consumedCredits: totalOperations,
      monthlyLimit: 1000,
      refillCredits: 0,
    })));
  }
}
