/**
 * File:        core/application/use-cases/identity/register-with-password/register-with-password.spec.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Unit tests for RegisterWithPasswordHandler
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RegisterWithPasswordHandler } from './register-with-password.handler';
import { InMemoryUserRepository } from '../../../../testing/in-memory-user.repository';
import { InMemorySessionRepository } from '../../../../testing/in-memory-session.repository';
import { FakePasswordHasher } from '../../../../testing/fake-password-hasher';
import { FakeJwtGateway } from '../../../../testing/fake-jwt.gateway';

describe('RegisterWithPasswordHandler', () => {
  it('registers a new user', async () => {
    const userRepo = new InMemoryUserRepository();
    const sessionRepo = new InMemorySessionRepository();
    const hasher = new FakePasswordHasher();
    const jwt = new FakeJwtGateway();
    const handler = new RegisterWithPasswordHandler(userRepo, sessionRepo, hasher, jwt);

    const result = await handler.execute({
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    });
    expect(result.isOk()).toBe(true);
  });

  it('rejects duplicate email', async () => {
    const userRepo = new InMemoryUserRepository();
    const sessionRepo = new InMemorySessionRepository();
    const hasher = new FakePasswordHasher();
    const jwt = new FakeJwtGateway();
    const handler = new RegisterWithPasswordHandler(userRepo, sessionRepo, hasher, jwt);

    await handler.execute({ email: 'dup@example.com', password: 'password123' });
    const result = await handler.execute({ email: 'dup@example.com', password: 'password123' });
    expect(result.isErr()).toBe(true);
  });

  it('rejects invalid email', async () => {
    const handler = new RegisterWithPasswordHandler(
      new InMemoryUserRepository(),
      new InMemorySessionRepository(),
      new FakePasswordHasher(),
      new FakeJwtGateway(),
    );

    const result = await handler.execute({ email: 'not-an-email', password: 'password123' });
    expect(result.isErr()).toBe(true);
  });
});