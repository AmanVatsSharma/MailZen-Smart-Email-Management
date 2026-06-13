/**
 * File:        apps/backend/src/core/application/use-cases/ai/accept-smart-reply/accept-smart-reply.handler.ts
 * Module:      AI · Use Case
 * Purpose:     Accept a smart reply suggestion. Records the acceptance
 *              in the SmartReply aggregate.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { SmartReply } from '../../../../domain/bounded-contexts/ai/smart-reply.aggregate';
import { SMART_REPLY_REPOSITORY, ISmartReplyRepository } from '../../../ports/repositories/smart-reply.repository';
import { NotFoundError, ValidationError } from '../../../exceptions/application-error';

export interface AcceptSmartReplyInput {
  smartReplyId: string;
  userId: string;
  suggestionIndex: number;
}

@Injectable()
export class AcceptSmartReplyHandler {
  constructor(
    @Inject(SMART_REPLY_REPOSITORY)
    private readonly replyRepo: ISmartReplyRepository,
  ) {}

  async execute(
    input: AcceptSmartReplyInput,
  ): Promise<Result<SmartReply, NotFoundError | ValidationError>> {
    const reply = await this.replyRepo.findById(input.smartReplyId);
    if (!reply) {
      return makeResult(Result.err(new NotFoundError('SmartReply')));
    }

    if (reply.userId !== input.userId) {
      return makeResult(Result.err(new NotFoundError('SmartReply')));
    }

    const totalCount = reply.suggestions.length;
    if (input.suggestionIndex < 0 || input.suggestionIndex >= totalCount) {
      return makeResult(Result.err(new ValidationError(
        `Invalid index: must be 0-${totalCount - 1}, got ${input.suggestionIndex}`
      )));
    }

    try {
      reply.accept(input.suggestionIndex);
      await this.replyRepo.save(reply);
      return makeResult(Result.ok(reply));
    } catch (e) {
      if (e instanceof ValidationError) {
        return makeResult(Result.err(e));
      }
      return makeResult(Result.err(new ValidationError('Failed to accept reply')));
    }
  }
}
