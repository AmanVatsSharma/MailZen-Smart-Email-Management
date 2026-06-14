/**
 * File:        core/application/use-cases/identity/refresh-token/refresh-token.spec.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Unit tests for RefreshTokenHandler
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RefreshTokenHandler } from './refresh-token.handler';
import { InMemoryUserRepository } from '../../../../testing/in-memory-user.repository';
import { InMemorySessionRepository } from '../../../../testing/in-memory-session.repository';
import { FakeJwtGateway } from '../../../../testing/fake-jwt.gateway';
import { User, UserRole } from '../../../../domain/bounded-contexts/identity/user.aggregate';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { Session } from '../../../../domain/bounded-contexts/identity/session.aggregate';
import { PasswordHash } from '../../../../domain/bounded-contexts/identity/value-objects/password-hash';
import { UserId } from '../../../../domain/shared/value-objects/ids';

describe('RefreshTokenHandler', () => {
  it('rotates valid refresh token', async () => {
    const userRepo = new InMemoryUserRepository();
    const sessionRepo = new InMemorySessionRepository();
    const jwt = new FakeJwtGateway();
    const handler = new RefreshTokenHandler(sessionRepo, jwt, userRepo);

    const email = EmailAddress.create('test@example.com').unwrap();
    const user = User.register(email, UserRole.User).unwrap();
    await userRepo.save(user);

    const session = Session.create(UserId.from(user.id), PasswordHash.unsafe('hash')).unwrap();
    await sessionRepo.save(session);

    const result = await handler.execute({ refreshToken: 'hash' });
    expect(result.isOk()).toBe(true);
  });

  it('rejects invalid refresh token', async () => {
    const handler = new RefreshTokenHandler(
      new InMemorySessionRepository(),
      new FakeJwtGateway(),
      new InMemoryUserRepository(),
    );

    const result = await handler.execute({ refreshToken: 'nonexistent' });
    expect(result.isErr()).toBe(true);
  });

  it('rejects expired session', async () => {
    const sessionRepo = new InMemorySessionRepository();
    const jwt = new FakeJwtGateway();
    const userRepo = new InMemoryUserRepository();
    const handler = new RefreshTokenHandler(sessionRepo, jwt, userRepo);

    const email = EmailAddress.create('test@example.com').unwrap();
    const user = User.register(email, UserRole.User).unwrap();
    await userRepo.save(user);

    const session = Session.create(UserId.from(user.id), PasswordHash.unsafe('hash2')).unwrap();
    session.revoke('test');
    await sessionRepo.save(session);

    const result = await handler.execute({ refreshToken: 'hash2' });
    expect(result.isErr()).toBe(true);
  });
});