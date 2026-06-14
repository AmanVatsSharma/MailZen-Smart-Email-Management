/**
 * File:        core/application/use-cases/identity/login-with-password/login-with-password.spec.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Unit tests for LoginWithPasswordHandler
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { LoginWithPasswordHandler } from './login-with-password.handler';
import { InMemoryUserRepository } from '../../../../testing/in-memory-user.repository';
import { InMemorySessionRepository } from '../../../../testing/in-memory-session.repository';
import { FakePasswordHasher } from '../../../../testing/fake-password-hasher';
import { FakeJwtGateway } from '../../../../testing/fake-jwt.gateway';
import { USER_REPOSITORY } from '../../../ports/repositories/user.repository';
import { SESSION_REPOSITORY } from '../../../ports/repositories/session.repository';
import { PASSWORD_HASHER } from '../../../ports/gateways/password-hasher.gateway';
import { JWT_GATEWAY } from '../../../ports/gateways/jwt.gateway';
import { User, UserRole } from '../../../../domain/bounded-contexts/identity/user.aggregate';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';

describe('LoginWithPasswordHandler', () => {
  let handler: LoginWithPasswordHandler;
  let userRepo: InMemoryUserRepository;
  let sessionRepo: InMemorySessionRepository;
  let hasher: FakePasswordHasher;
  let jwt: FakeJwtGateway;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    sessionRepo = new InMemorySessionRepository();
    hasher = new FakePasswordHasher();
    jwt = new FakeJwtGateway();

    const email = EmailAddress.create('test@example.com').unwrap();
    const user = User.register(email, UserRole.User).unwrap();
    (user as any).passwordHash = await hasher.hash('password123');
    await userRepo.save(user);

    handler = new LoginWithPasswordHandler(
      { [USER_REPOSITORY.toString()]: userRepo } as any,
      { [SESSION_REPOSITORY.toString()]: sessionRepo } as any,
      { [PASSWORD_HASHER.toString()]: hasher } as any,
      { [JWT_GATEWAY.toString()]: jwt } as any,
    );
  });

  it('logs in with valid credentials', async () => {
    const result = await handler.execute({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.isOk()).toBe(true);
  });

  it('rejects invalid password', async () => {
    const result = await handler.execute({
      email: 'test@example.com',
      password: 'wrong',
    });
    expect(result.isErr()).toBe(true);
  });

  it('rejects unknown email', async () => {
    const result = await handler.execute({
      email: 'noone@example.com',
      password: 'password123',
    });
    expect(result.isErr()).toBe(true);
  });
});