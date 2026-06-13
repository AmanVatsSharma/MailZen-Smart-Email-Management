/**
 * File:        apps/backend/src/core/application/use-cases/ai/reject-smart-reply/reject-smart-reply.handler.ts
 * Module:      AI · Use Case
 * Purpose:     Reject a smart reply suggestion. Records the rejection
 *              in the SmartReply aggregate.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { SmartReply } from '../../../../domain/bounded-contexts/ai/smart-reply.aggregate';
import { SMART_REPLY_REPOSITORY, ISmartReplyRepository } from '../../../ports/repositories/smart-reply.repository';
import { NotFoundError, ValidationError } from '../../../exceptions/application-error';

export interface RejectSmartReplyInput {
  smartReplyId: string;
  userId: string;
  suggestionIndex: number;
}

@Injectable()
export class RejectSmartReplyHandler {
  constructor(
    @Inject(SMART_REPLY_REPOSITORY)
    private readonly replyRepo: ISmartReplyRepository,
  ) {}

  async execute(
    input: RejectSmartReplyInput,
  ): Promise<Result<SmartReply, NotFoundError | ValidationError>> {
    const reply = await this.replyRepo.findById(input.smartReplyId);
    if (!reply) {
      return makeResult(Result.err(new NotFoundError('SmartReply')));
    }

    if (reply.userId !== input.userId) {
      return makeResult(Result.err(new NotFoundError('SmartReply')));
    }

    try {
      reply.reject(input.suggestionIndex);
      await this.replyRepo.save(reply);
      return makeResult(Result.ok(reply));
    } catch (e) {
      if (e instanceof ValidationError) {
        return makeResult(Result.err(e));
      }
      return makeResult(Result.err(new ValidationError(
        e instanceof Error ? e.message : 'Failed to reject reply'
      )));
    }
  }
}
