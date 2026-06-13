/**
 * File:        apps/backend/src/core/application/use-cases/ai/generate-smart-reply/generate-smart-reply.handler.ts
 * Module:      AI · Use Case
 * Purpose:     Generate smart replies for an email. Calls the AI gateway
 *              and persists the suggestions in a SmartReply aggregate.
 *              Re-shape of `smart-reply.service.generateReply`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Result, makeResult } from '../../../../domain/shared/result';
import { SmartReply } from '../../../../domain/bounded-contexts/ai/smart-reply.aggregate';
import { SMART_REPLY_REPOSITORY, ISmartReplyRepository } from '../../../ports/repositories/smart-reply.repository';
import { AI_GATEWAY, IAiGateway, EmailSummary, SmartReplyContext } from '../../../ports/gateways/ai.gateway';
import { EmailMessageSummary } from '../../../ports/gateways/email-provider.gateway';
import { NotFoundError, ValidationError } from '../../../exceptions/application-error';

export interface GenerateSmartReplyInput {
  emailId: string;
  workspaceId: string;
  userId: string;
  tone?: string;
  email: EmailMessageSummary;
}

export interface GenerateSmartReplyOutput {
  smartReplyId: string;
  suggestions: { text: string; score: number }[];
  tone: string | null;
}

@Injectable()
export class GenerateSmartReplyHandler {
  private static readonly MIN_SCORE = 0;
  private static readonly MAX_SCORE = 100;
  private static readonly MAX_SUGGESTIONS = 5;

  constructor(
    @Inject(SMART_REPLY_REPOSITORY)
    private readonly replyRepo: ISmartReplyRepository,
    @Inject(AI_GATEWAY)
    private readonly aiGateway: IAiGateway,
  ) {}

  async execute(
    input: GenerateSmartReplyInput,
  ): Promise<Result<GenerateSmartReplyOutput, NotFoundError | ValidationError>> {
    try {
      const context: SmartReplyContext = {
        emailId: input.emailId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        tone: input.tone,
      };

      const email: EmailSummary = {
        id: input.emailId,
        subject: input.email.subject,
        from: input.email.from,
        body: input.email.body,
      };

      const rawSuggestions = await this.aiGateway.generateSmartReply(email, context);
      const suggestions = rawSuggestions
        .filter((s) => s.score >= GenerateSmartReplyHandler.MIN_SCORE &&
                       s.score <= GenerateSmartReplyHandler.MAX_SCORE)
        .slice(0, GenerateSmartReplyHandler.MAX_SUGGESTIONS);

      if (suggestions.length === 0) {
        return makeResult(Result.err(new ValidationError('No valid suggestions generated')));
      }

      const smartReply = SmartReply.create({
        id: randomUUID(),
        emailId: input.emailId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        suggestions,
        tone: input.tone,
      });

      await this.replyRepo.save(smartReply);

      return makeResult(Result.ok({
        smartReplyId: smartReply.id,
        suggestions,
        tone: smartReply.tone,
      }));
    } catch (e) {
      if (e instanceof ValidationError) {
        return makeResult(Result.err(e));
      }
      return makeResult(Result.err(new ValidationError(
        e instanceof Error ? e.message : 'Failed to generate smart replies'
      )));
    }
  }
}
