/**
 * File:        core/application/use-cases/identity/enable-2fa/enable-2fa.spec.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Unit tests for Enable2faHandler
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Enable2faHandler } from './enable-2fa.handler';
import { InMemoryUserRepository } from '../../../../testing/in-memory-user.repository';
import { User, UserRole } from '../../../../domain/bounded-contexts/identity/user.aggregate';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';

describe('Enable2faHandler', () => {
  it('enables 2fa for user', async () => {
    const userRepo = new InMemoryUserRepository();
    const email = EmailAddress.create('user@example.com').unwrap();
    const user = User.register(email, UserRole.User).unwrap();
    await userRepo.save(user);

    const handler = new Enable2faHandler(userRepo);
    const result = await handler.execute({ userId: user.id });
    expect(result.isOk()).toBe(true);
  });

  it('returns not found for unknown user', async () => {
    const handler = new Enable2faHandler(new InMemoryUserRepository());
    const result = await handler.execute({ userId: '00000000-0000-0000-0000-000000000000' });
    expect(result.isErr()).toBe(true);
  });

  it('is idempotent when 2fa already enabled', async () => {
    const userRepo = new InMemoryUserRepository();
    const email = EmailAddress.create('user@example.com').unwrap();
    const user = User.register(email, UserRole.User).unwrap();
    user.enable2fa();
    await userRepo.save(user);

    const handler = new Enable2faHandler(userRepo);
    const result = await handler.execute({ userId: user.id });
    expect(result.isOk()).toBe(true);
  });
});