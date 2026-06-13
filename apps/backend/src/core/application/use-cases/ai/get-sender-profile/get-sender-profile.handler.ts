/**
 * File:        apps/backend/src/core/application/use-cases/ai/get-sender-profile/get-sender-profile.handler.ts
 * Module:      AI · Use Case
 * Purpose:     Retrieve the sender profile for a given sender email.
 *              Returns null when no profile exists yet.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { SenderProfile } from '../../../../domain/bounded-contexts/ai/sender-intelligence.aggregate';
import { SENDER_PROFILE_REPOSITORY, ISenderProfileRepository } from '../../../ports/repositories/sender-profile.repository';
import { NotFoundError } from '../../../exceptions/application-error';

export interface GetSenderProfileInput {
  senderEmail: string;
  userId: string;
  workspaceId?: string;
}

@Injectable()
export class GetSenderProfileHandler {
  constructor(
    @Inject(SENDER_PROFILE_REPOSITORY)
    private readonly profileRepo: ISenderProfileRepository,
  ) {}

  async execute(
    input: GetSenderProfileInput,
  ): Promise<Result<SenderProfile, NotFoundError>> {
    const profile = await this.profileRepo.findByEmailAddress(input.senderEmail);
    if (!profile) {
      return makeResult(Result.err(new NotFoundError('SenderProfile')));
    }

    if (input.workspaceId && profile.workspaceId !== input.workspaceId) {
      return makeResult(Result.err(new NotFoundError('SenderProfile')));
    }

    return makeResult(Result.ok(profile));
  }
}
