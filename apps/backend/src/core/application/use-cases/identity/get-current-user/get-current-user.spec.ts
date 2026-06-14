/**
 * File:        core/application/use-cases/identity/get-current-user/get-current-user.spec.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Unit tests for GetCurrentUserHandler
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { GetCurrentUserHandler } from './get-current-user.handler';
import { InMemoryUserRepository } from '../../../../testing/in-memory-user.repository';
import { User, UserRole } from '../../../../domain/bounded-contexts/identity/user.aggregate';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';

describe('GetCurrentUserHandler', () => {
  it('returns current user', async () => {
    const userRepo = new InMemoryUserRepository();
    const email = EmailAddress.create('me@example.com').unwrap();
    const user = User.register(email, UserRole.User).unwrap();
    await userRepo.save(user);

    const handler = new GetCurrentUserHandler(userRepo);
    const result = await handler.execute({ userId: user.id });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.email).toBe('me@example.com');
    }
  });

  it('returns not found for unknown user', async () => {
    const handler = new GetCurrentUserHandler(new InMemoryUserRepository());
    const result = await handler.execute({ userId: '00000000-0000-0000-0000-000000000000' });
    expect(result.isErr()).toBe(true);
  });

  it('returns not found for empty user id', async () => {
    const handler = new GetCurrentUserHandler(new InMemoryUserRepository());
    const result = await handler.execute({ userId: '' });
    expect(result.isErr()).toBe(true);
  });
});