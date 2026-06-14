/**
 * File:        core/application/use-cases/identity/get-current-user/get-current-user.handler.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Get the currently authenticated user's profile
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { IUserRepository, USER_REPOSITORY } from '../../../ports/repositories/user.repository';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { NotFoundError } from '../../../exceptions/application-error';
import { GetCurrentUserInput, GetCurrentUserOutput } from './get-current-user.dto';

@Injectable()
export class GetCurrentUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: GetCurrentUserInput): Promise<Result<GetCurrentUserOutput, NotFoundError>> {
    const userId = typeof input.userId === 'string' ? UserId.from(input.userId) : input.userId;
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return makeResult(Result.err(new NotFoundError('User')));
    }

    return makeResult(Result.ok({
      id: user.id,
      email: user.email.toString(),
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      is2faEnabled: user.is2faEnabled,
    }));
  }
}