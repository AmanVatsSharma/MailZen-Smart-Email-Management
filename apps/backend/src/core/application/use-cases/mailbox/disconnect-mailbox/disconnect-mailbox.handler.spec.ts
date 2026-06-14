/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/disconnect-mailbox/disconnect-mailbox.handler.spec.ts
 * Module:      Mailbox · Use Case · Test
 * Purpose:     Unit tests for DisconnectMailboxHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { DisconnectMailboxHandler } from './disconnect-mailbox.handler';
import { InMemoryMailboxRepository } from '../../../../testing/in-memory-mailbox.repository';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { ProviderType } from '../../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

describe('DisconnectMailboxHandler', () => {
  let handler: DisconnectMailboxHandler;
  let repo: InMemoryMailboxRepository;

  beforeEach(() => {
    repo = new InMemoryMailboxRepository();
    handler = new DisconnectMailboxHandler(repo);
  });

  it('disconnects an existing mailbox', async () => {
    const mailbox = Mailbox.create({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.GMAIL,
      emailAddress: 'user@gmail.com',
    });
    mailbox.markConnected();
    await repo.save(mailbox);

    const result = await handler.execute({
      mailboxId: 'm-1',
      userId: 'u-1',
      reason: 'user_initiated',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.isConnected).toBe(false);
    }
  });

  it('returns NotFound for missing mailbox', async () => {
    const result = await handler.execute({
      mailboxId: 'missing',
      userId: 'u-1',
      reason: 'user_initiated',
    });
    expect(result.isErr()).toBe(true);
  });
});
