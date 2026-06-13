/**
 * File:        apps/backend/src/core/application/use-cases/ai/triage-inbox/triage-inbox.handler.ts
 * Module:      AI · Use Case
 * Purpose:     Triage an inbox email. Calls the AI gateway to classify
 *              the email and persists a TriageResult aggregate. Mirrors
 *              the priority/class label merge in `inbox-triage.service`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Result, makeResult } from '../../../../domain/shared/result';
import { TriageResult, TriagePriority, TriageCategory, SuggestedAction } from '../../../../domain/bounded-contexts/ai/triage-result.aggregate';
import { TRIAGE_RESULT_REPOSITORY, ITriageResultRepository } from '../../../ports/repositories/triage-result.repository';
import { AI_GATEWAY, IAiGateway, EmailSummary } from '../../../ports/gateways/ai.gateway';
import { NotFoundError } from '../../../exceptions/application-error';
import { EmailMessageSummary } from '../../../ports/gateways/email-provider.gateway';

export interface TriageInboxInput {
  emailId: string;
  workspaceId: string;
  userId: string;
  email: EmailMessageSummary;
}

export interface TriageInboxOutput {
  triageResultId: string;
  priority: TriagePriority;
  category: TriageCategory;
  reasoning: string;
  suggestedActions: SuggestedAction[];
}

@Injectable()
export class TriageInboxHandler {
  constructor(
    @Inject(TRIAGE_RESULT_REPOSITORY)
    private readonly triageRepo: ITriageResultRepository,
    @Inject(AI_GATEWAY)
    private readonly aiGateway: IAiGateway,
  ) {}

  async execute(
    input: TriageInboxInput,
  ): Promise<Result<TriageInboxOutput, NotFoundError>> {
    try {
      const email: EmailSummary = {
        id: input.emailId,
        subject: input.email.subject,
        from: input.email.from,
        body: input.email.body,
      };

      const triageData = await this.aiGateway.triageEmail(email);

      const triageResult = TriageResult.create({
        id: randomUUID(),
        emailId: input.emailId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        priority: triageData.priority,
        category: triageData.category,
        reasoning: triageData.reasoning,
        suggestedActions: triageData.suggestedActions,
      });

      await this.triageRepo.save(triageResult);

      return makeResult(Result.ok({
        triageResultId: triageResult.id,
        priority: triageResult.priority,
        category: triageResult.category,
        reasoning: triageResult.reasoning,
        suggestedActions: [...triageResult.suggestedActions],
      }));
    } catch (e) {
      return makeResult(Result.err(new NotFoundError(
        e instanceof Error ? e.message : 'Triage failed'
      )));
    }
  }
}
