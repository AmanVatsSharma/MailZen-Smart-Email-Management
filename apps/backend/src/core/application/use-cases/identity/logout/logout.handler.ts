/**
 * File:        core/application/use-cases/identity/logout/logout.handler.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Revoke user session by refresh token
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ISessionRepository, SESSION_REPOSITORY } from '../../../ports/repositories/session.repository';
import { IJwtGateway, JWT_GATEWAY } from '../../../ports/gateways/jwt.gateway';
import { LogoutInput, LogoutOutput } from './logout.dto';

@Injectable()
export class LogoutHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
    @Inject(JWT_GATEWAY) private readonly jwtGateway: IJwtGateway,
  ) {}

  async execute(input: LogoutInput): Promise<Result<LogoutOutput, Error>> {
    if (!input.refreshToken) {
      return makeResult(Result.ok({ success: true }));
    }

    const { hash } = await this.jwtGateway.signRefreshToken();
    const session = await this.sessionRepository.findByRefreshTokenHash(hash);

    if (session) {
      session.revoke('logout');
      await this.sessionRepository.save(session);
    }

    return makeResult(Result.ok({ success: true }));
  }
}