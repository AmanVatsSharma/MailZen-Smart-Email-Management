/**
 * File:        core/application/use-cases/identity/oauth-callback/oauth-callback.spec.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Unit tests for OAuthCallbackHandler
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { OAuthCallbackHandler } from './oauth-callback.handler';
import { InMemoryUserRepository } from '../../../../testing/in-memory-user.repository';
import { InMemorySessionRepository } from '../../../../testing/in-memory-session.repository';
import { FakeJwtGateway } from '../../../../testing/fake-jwt.gateway';
import { FakeOAuthGateway } from '../../../../testing/fake-oauth.gateway';
import { OAuthProfile, OAuthProvider } from '../../../../domain/bounded-contexts/identity/value-objects/oauth-profile';

describe('OAuthCallbackHandler', () => {
  it('handles valid OAuth callback for new user', async () => {
    const userRepo = new InMemoryUserRepository();
    const sessionRepo = new InMemorySessionRepository();
    const jwt = new FakeJwtGateway();
    const oauth = new FakeOAuthGateway();

    const profile = OAuthProfile.create({
      provider: OAuthProvider.GOOGLE,
      providerUserId: 'google-123',
      email: 'new@example.com',
      displayName: 'New User',
    }).unwrap();
    oauth.presetProfile('valid-code', profile);

    const handler = new OAuthCallbackHandler(userRepo, sessionRepo, oauth, jwt);
    const result = await handler.execute({ provider: OAuthProvider.GOOGLE, code: 'valid-code' });
    expect(result.isOk()).toBe(true);
  });

  it('rejects invalid OAuth code', async () => {
    const handler = new OAuthCallbackHandler(
      new InMemoryUserRepository(),
      new InMemorySessionRepository(),
      new FakeOAuthGateway(),
      new FakeJwtGateway(),
    );
    const result = await handler.execute({ provider: OAuthProvider.GOOGLE, code: 'bad-code' });
    expect(result.isErr()).toBe(true);
  });

  it('handles existing user OAuth login', async () => {
    const userRepo = new InMemoryUserRepository();
    const sessionRepo = new InMemorySessionRepository();
    const jwt = new FakeJwtGateway();
    const oauth = new FakeOAuthGateway();

    // Pre-create user with same email
    const { User } = await import('../../../../domain/bounded-contexts/identity/user.aggregate');
    const { EmailAddress } = await import('../../../../domain/shared/value-objects/email-address');
    const { UserRole } = await import('../../../../domain/bounded-contexts/identity/user.aggregate');
    const email = EmailAddress.create('existing@example.com').unwrap();
    const user = User.register(email, UserRole.User).unwrap();
    await userRepo.save(user);

    const profile = OAuthProfile.create({
      provider: OAuthProvider.MICROSOFT,
      providerUserId: 'ms-456',
      email: 'existing@example.com',
    }).unwrap();
    oauth.presetProfile('valid-code-2', profile);

    const handler = new OAuthCallbackHandler(userRepo, sessionRepo, oauth, jwt);
    const result = await handler.execute({ provider: OAuthProvider.MICROSOFT, code: 'valid-code-2' });
    expect(result.isOk()).toBe(true);
  });
});