/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/list-mailboxes/list-mailboxes.handler.spec.ts
 * Module:      Mailbox · Use Case · Test
 * Purpose:     Unit tests for ListMailboxesHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListMailboxesHandler } from './list-mailboxes.handler';
import { InMemoryMailboxRepository } from '../../../../testing/in-memory-mailbox.repository';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { ProviderType } from '../../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

describe('ListMailboxesHandler', () => {
  let handler: ListMailboxesHandler;
  let repo: InMemoryMailboxRepository;

  beforeEach(async () => {
    repo = new InMemoryMailboxRepository();
    handler = new ListMailboxesHandler(repo);
    await repo.save(Mailbox.create({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.GMAIL,
      emailAddress: 'a@gmail.com',
    }));
    await repo.save(Mailbox.create({
      id: 'm-2',
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.OUTLOOK,
      emailAddress: 'b@outlook.com',
    }));
  });

  it('returns mailboxes for a user', async () => {
    const result = await handler.execute({ userId: 'u-1' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(2);
    }
  });

  it('returns mailboxes scoped to a workspace', async () => {
    const result = await handler.execute({ userId: 'u-1', workspaceId: 'ws-1' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(2);
    }
  });
});
