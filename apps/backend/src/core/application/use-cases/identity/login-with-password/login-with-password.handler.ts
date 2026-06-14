/**
 * File:        core/application/use-cases/identity/login-with-password/login-with-password.handler.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Authenticate user with email and password, issue JWT and refresh token
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { IUserRepository, USER_REPOSITORY } from '../../../ports/repositories/user.repository';
import { ISessionRepository, SESSION_REPOSITORY } from '../../../ports/repositories/session.repository';
import { IPasswordHasher, PASSWORD_HASHER } from '../../../ports/gateways/password-hasher.gateway';
import { IJwtGateway, JWT_GATEWAY } from '../../../ports/gateways/jwt.gateway';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { Session } from '../../../../domain/bounded-contexts/identity/session.aggregate';
import { PasswordHash } from '../../../../domain/bounded-contexts/identity/value-objects/password-hash';
import { UnauthorizedError, ValidationError } from '../../../exceptions/application-error';
import { LoginWithPasswordInput, LoginWithPasswordOutput } from './login-with-password.dto';

@Injectable()
export class LoginWithPasswordHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(JWT_GATEWAY) private readonly jwtGateway: IJwtGateway,
  ) {}

  async execute(input: LoginWithPasswordInput): Promise<Result<LoginWithPasswordOutput, UnauthorizedError | ValidationError>> {
    if (!input.email || !input.password) {
      return makeResult(Result.err(new ValidationError('Email and password are required')));
    }

    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      return makeResult(Result.err(new UnauthorizedError('Invalid email or password')));
    }

    // In the legacy system, the password hash is stored on the user entity.
    // The new clean architecture moves this to the IPasswordHasher gateway.
    // We delegate verification to the gateway; the password hash is exposed
    // via the user's underlying record (managed by the repository adapter).
    const isValid = await this.passwordHasher.verify(input.password, (user as any).passwordHash || '');
    if (!isValid) {
      return makeResult(Result.err(new UnauthorizedError('Invalid email or password')));
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
        role: user.role,
      },
    }));
  }
}