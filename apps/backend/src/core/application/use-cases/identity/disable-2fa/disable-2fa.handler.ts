/**
 * File:        core/application/use-cases/identity/disable-2fa/disable-2fa.handler.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Disable two-factor authentication for the user
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { IUserRepository, USER_REPOSITORY } from '../../../ports/repositories/user.repository';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { NotFoundError } from '../../../exceptions/application-error';
import { Disable2faInput, Disable2faOutput } from './disable-2fa.dto';

@Injectable()
export class Disable2faHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: Disable2faInput): Promise<Result<Disable2faOutput, NotFoundError>> {
    const userId = typeof input.userId === 'string' ? UserId.from(input.userId) : input.userId;
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return makeResult(Result.err(new NotFoundError('User')));
    }

    user.disable2fa();
    await this.userRepository.save(user);

    return makeResult(Result.ok({
      userId: user.id,
      enabled: false,
    }));
  }
}