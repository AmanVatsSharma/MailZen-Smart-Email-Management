/**
 * File:        core/application/use-cases/identity/refresh-token/refresh-token.handler.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Rotate refresh token and issue new access token
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ISessionRepository, SESSION_REPOSITORY } from '../../../ports/repositories/session.repository';
import { IJwtGateway, JWT_GATEWAY } from '../../../ports/gateways/jwt.gateway';
import { IUserRepository, USER_REPOSITORY } from '../../../ports/repositories/user.repository';
import { PasswordHash } from '../../../../domain/bounded-contexts/identity/value-objects/password-hash';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { Session } from '../../../../domain/bounded-contexts/identity/session.aggregate';
import { UnauthorizedError, NotFoundError } from '../../../exceptions/application-error';
import { RefreshTokenInput, RefreshTokenOutput } from './refresh-token.dto';

@Injectable()
export class RefreshTokenHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
    @Inject(JWT_GATEWAY) private readonly jwtGateway: IJwtGateway,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: RefreshTokenInput): Promise<Result<RefreshTokenOutput, UnauthorizedError | NotFoundError>> {
    // In a real implementation, we'd hash the refresh token client provided,
    // then look it up. Here, we rely on the gateway to produce a deterministic
    // hash from the raw token. The repository adapter handles the actual hash lookup.
    // For the use-case abstraction, we work with the user-provided token directly.

    // Find the existing session by the supplied refresh token via the session repository
    const session = await this.sessionRepository.findByRefreshTokenHash(input.refreshToken);

    if (!session || !session.isActive) {
      return makeResult(Result.err(new UnauthorizedError('Invalid refresh token')));
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      return makeResult(Result.err(new NotFoundError('User')));
    }

    // Revoke the old session
    session.revoke('rotated');
    await this.sessionRepository.save(session);

    // Issue a new access + refresh token
    const accessToken = await this.jwtGateway.signAccessToken({
      sub: user.id,
      email: user.email.toString(),
      role: user.role,
    });

    const { token: newRefreshToken, hash: newHash } = await this.jwtGateway.signRefreshToken();
    const newSessionResult = Session.create(
      UserId.from(user.id),
      PasswordHash.unsafe(newHash),
      input.ip,
      input.userAgent,
    );

    if (newSessionResult.isErr()) {
      return makeResult(Result.err(new UnauthorizedError('Failed to create new session')));
    }

    await this.sessionRepository.save(newSessionResult.unwrap());

    return makeResult(Result.ok({
      accessToken,
      refreshToken: newRefreshToken,
      userId: user.id,
    }));
  }
}