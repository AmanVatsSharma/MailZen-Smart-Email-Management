/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/process-pubsub-notification/process-pubsub-notification.handler.spec.ts
 * Module:      Mailbox · Use Case · Test
 * Purpose:     Unit tests for ProcessPubSubNotificationHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ProcessPubSubNotificationHandler } from './process-pubsub-notification.handler';
import { InMemoryMailboxRepository } from '../../../../testing/in-memory-mailbox.repository';
import { FakePubSubGateway } from '../../../../testing/fake-pubsub.gateway';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { ProviderType } from '../../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

describe('ProcessPubSubNotificationHandler', () => {
  let handler: ProcessPubSubNotificationHandler;
  let mailboxRepo: InMemoryMailboxRepository;
  let pubsub: FakePubSubGateway;

  beforeEach(async () => {
    mailboxRepo = new InMemoryMailboxRepository();
    pubsub = new FakePubSubGateway();
    handler = new ProcessPubSubNotificationHandler(mailboxRepo, pubsub);
    const m = Mailbox.create({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.GMAIL,
      emailAddress: 'a@gmail.com',
    });
    await mailboxRepo.save(m);
  });

  it('triggers sync for the target mailbox', async () => {
    const data = Buffer.from(JSON.stringify({
      mailboxId: 'm-1',
      accessToken: 'tok',
    }));
    const result = await handler.execute({
      messageId: 'msg-1',
      subscriptionId: 'sub-1',
      data,
      attributes: { expiration: '0', data: '', messageId: 'msg-1' },
    });
    expect(result.isOk()).toBe(true);
    expect(pubsub.publishedMessages.length).toBe(1);
  });

  it('returns NotFound for unknown mailbox', async () => {
    const data = Buffer.from(JSON.stringify({ mailboxId: 'missing', accessToken: 'tok' }));
    const result = await handler.execute({
      messageId: 'msg-1',
      subscriptionId: 'sub-1',
      data,
      attributes: { expiration: '0', data: '', messageId: 'msg-1' },
    });
    expect(result.isErr()).toBe(true);
  });
});
