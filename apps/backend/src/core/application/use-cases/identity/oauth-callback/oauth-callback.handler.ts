/**
 * File:        core/application/use-cases/identity/oauth-callback/oauth-callback.handler.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Handle OAuth provider callback, upsert user, issue tokens
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { IUserRepository, USER_REPOSITORY } from '../../../ports/repositories/user.repository';
import { ISessionRepository, SESSION_REPOSITORY } from '../../../ports/repositories/session.repository';
import { IOAuthGateway, OAUTH_GATEWAY } from '../../../ports/gateways/oauth.gateway';
import { IJwtGateway, JWT_GATEWAY } from '../../../ports/gateways/jwt.gateway';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { User, UserRole } from '../../../../domain/bounded-contexts/identity/user.aggregate';
import { Session } from '../../../../domain/bounded-contexts/identity/session.aggregate';
import { PasswordHash } from '../../../../domain/bounded-contexts/identity/value-objects/password-hash';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { ValidationError, UnauthorizedError } from '../../../exceptions/application-error';
import { OAuthCallbackInput, OAuthCallbackOutput } from './oauth-callback.dto';

@Injectable()
export class OAuthCallbackHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
    @Inject(OAUTH_GATEWAY) private readonly oauthGateway: IOAuthGateway,
    @Inject(JWT_GATEWAY) private readonly jwtGateway: IJwtGateway,
  ) {}

  async execute(input: OAuthCallbackInput): Promise<Result<OAuthCallbackOutput, ValidationError | UnauthorizedError>> {
    const profileResult = await this.oauthGateway.exchangeCodeForProfile(input.provider, input.code);
    if (profileResult.isErr()) {
      return makeResult(Result.err(new UnauthorizedError('OAuth exchange failed')));
    }

    const profile = profileResult.unwrap();
    const existing = await this.userRepository.findByEmail(profile.email);
    let user: User;
    let isNewUser = false;

    if (!existing) {
      const emailResult = EmailAddress.create(profile.email);
      if (emailResult.isErr()) {
        return makeResult(Result.err(new ValidationError('Invalid email from OAuth')));
      }
      const userResult = User.register(emailResult.unwrap(), UserRole.User);
      if (userResult.isErr()) {
        return makeResult(Result.err(new ValidationError('Failed to create user')));
      }
      user = userResult.unwrap();
      user.markEmailVerified();
      await this.userRepository.save(user);
      isNewUser = true;
    } else {
      user = existing;
    }

    const accessToken = await this.jwtGateway.signAccessToken({
      sub: user.id,
      email: user.email.toString(),
      role: user.role,
    });

    const { token: refreshToken, hash: refreshHash } = await this.jwtGateway.signRefreshToken();
    const sessionResult = Session.create(
      UserId.from(user.id),
      PasswordHash.unsafe(refreshHash),
      input.ip,
      input.userAgent,
    );

    if (sessionResult.isErr()) {
      return makeResult(Result.err(new ValidationError('Failed to create session')));
    }

    await this.sessionRepository.save(sessionResult.unwrap());

    return makeResult(Result.ok({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email.toString(),
      },
      isNewUser,
    }));
  }
}