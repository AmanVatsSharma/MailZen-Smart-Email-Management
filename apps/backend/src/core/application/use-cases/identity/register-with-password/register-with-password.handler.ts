/**
 * File:        core/application/use-cases/identity/register-with-password/register-with-password.handler.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Register a new user with email and password
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { IUserRepository, USER_REPOSITORY } from '../../../ports/repositories/user.repository';
import { ISessionRepository, SESSION_REPOSITORY } from '../../../ports/repositories/session.repository';
import { IPasswordHasher, PASSWORD_HASHER } from '../../../ports/gateways/password-hasher.gateway';
import { IJwtGateway, JWT_GATEWAY } from '../../../ports/gateways/jwt.gateway';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { User, UserRole } from '../../../../domain/bounded-contexts/identity/user.aggregate';
import { Session } from '../../../../domain/bounded-contexts/identity/session.aggregate';
import { PasswordHash } from '../../../../domain/bounded-contexts/identity/value-objects/password-hash';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { ConflictError, ValidationError } from '../../../exceptions/application-error';
import { RegisterWithPasswordInput, RegisterWithPasswordOutput } from './register-with-password.dto';

@Injectable()
export class RegisterWithPasswordHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(JWT_GATEWAY) private readonly jwtGateway: IJwtGateway,
  ) {}

  async execute(input: RegisterWithPasswordInput): Promise<Result<RegisterWithPasswordOutput, ConflictError | ValidationError>> {
    const emailResult = EmailAddress.create(input.email);
    if (emailResult.isErr()) {
      return makeResult(Result.err(new ValidationError('Invalid email', 'email')));
    }

    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      return makeResult(Result.err(new ConflictError('Email already registered')));
    }

    const userResult = User.register(emailResult.unwrap(), UserRole.User);
    if (userResult.isErr()) {
      return makeResult(Result.err(new ValidationError('Invalid user data')));
    }
    const user = userResult.unwrap();

    await this.userRepository.save(user);

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