/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/sync-mailbox/sync-mailbox.handler.spec.ts
 * Module:      Mailbox · Use Case · Test
 * Purpose:     Unit tests for SyncMailboxHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { SyncMailboxHandler } from './sync-mailbox.handler';
import { InMemoryMailboxRepository } from '../../../../testing/in-memory-mailbox.repository';
import { FakeEmailProviderGateway } from '../../../../testing/fake-email-provider.gateway';
import { FakeSyncLeaseGateway } from '../../../../testing/fake-sync-lease.gateway';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { ProviderType } from '../../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

describe('SyncMailboxHandler', () => {
  let handler: SyncMailboxHandler;
  let mailboxRepo: InMemoryMailboxRepository;
  let providerGateway: FakeEmailProviderGateway;
  let leaseGateway: FakeSyncLeaseGateway;

  beforeEach(async () => {
    mailboxRepo = new InMemoryMailboxRepository();
    providerGateway = new FakeEmailProviderGateway();
    leaseGateway = new FakeSyncLeaseGateway();
    handler = new SyncMailboxHandler(mailboxRepo, leaseGateway, providerGateway);
    const mailbox = Mailbox.create({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.GMAIL,
      emailAddress: 'a@gmail.com',
    });
    mailbox.markConnected();
    await mailboxRepo.save(mailbox);

    providerGateway.setNextResponse({
      messages: [
        { id: '1', externalId: 'ext-1', subject: 'a', from: 'x@x.com', date: new Date(), body: 'b' },
      ],
      nextCursor: 'next-cursor-1',
    });
  });

  it('fetches new messages and updates the cursor', async () => {
    const result = await handler.execute({
      mailboxId: 'm-1',
      userId: 'u-1',
      accessToken: 'access-token',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.newMessages).toBe(1);
      expect(result.value.nextCursor).toBe('next-cursor-1');
    }

    const mailbox = await mailboxRepo.findById('m-1');
    expect(mailbox?.syncCursor).toBe('next-cursor-1');
  });
});
