/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/set-primary-mailbox/set-primary-mailbox.handler.spec.ts
 * Module:      Mailbox · Use Case · Test
 * Purpose:     Unit tests for SetPrimaryMailboxHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { SetPrimaryMailboxHandler } from './set-primary-mailbox.handler';
import { InMemoryMailboxRepository } from '../../../../testing/in-memory-mailbox.repository';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { ProviderType } from '../../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

describe('SetPrimaryMailboxHandler', () => {
  let handler: SetPrimaryMailboxHandler;
  let repo: InMemoryMailboxRepository;

  beforeEach(async () => {
    repo = new InMemoryMailboxRepository();
    handler = new SetPrimaryMailboxHandler(repo);
    const m1 = Mailbox.create({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.GMAIL,
      emailAddress: 'a@gmail.com',
    });
    m1.markPrimary();
    await repo.save(m1);
    await repo.save(Mailbox.create({
      id: 'm-2',
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.OUTLOOK,
      emailAddress: 'b@outlook.com',
    }));
  });

  it('transfers primary to the target mailbox', async () => {
    const result = await handler.execute({ mailboxId: 'm-2', userId: 'u-1' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.isPrimary).toBe(true);
    }

    const m1 = await repo.findById('m-1');
    expect(m1?.isPrimary).toBe(false);
  });
});
