/**
 * File:        core/application/use-cases/identity/logout/logout.spec.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Unit tests for LogoutHandler
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { LogoutHandler } from './logout.handler';
import { InMemorySessionRepository } from '../../../../testing/in-memory-session.repository';
import { FakeJwtGateway } from '../../../../testing/fake-jwt.gateway';

describe('LogoutHandler', () => {
  it('logs out without refresh token', async () => {
    const handler = new LogoutHandler(new InMemorySessionRepository(), new FakeJwtGateway());
    const result = await handler.execute({});
    expect(result.isOk()).toBe(true);
  });

  it('logs out with refresh token', async () => {
    const handler = new LogoutHandler(new InMemorySessionRepository(), new FakeJwtGateway());
    const result = await handler.execute({ refreshToken: 'token' });
    expect(result.isOk()).toBe(true);
  });

  it('succeeds even when session not found', async () => {
    const handler = new LogoutHandler(new InMemorySessionRepository(), new FakeJwtGateway());
    const result = await handler.execute({ refreshToken: 'nonexistent' });
    expect(result.isOk()).toBe(true);
  });
});