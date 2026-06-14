/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/refresh-provider-tokens/refresh-provider-tokens.handler.spec.ts
 * Module:      Mailbox · Use Case · Test
 * Purpose:     Unit tests for RefreshProviderTokensHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RefreshProviderTokensHandler } from './refresh-provider-tokens.handler';
import { InMemoryMailboxRepository } from '../../../../testing/in-memory-mailbox.repository';
import { InMemoryEmailProviderRepository } from '../../../../testing/in-memory-email-provider.repository';
import { FakeEmailProviderGateway } from '../../../../testing/fake-email-provider.gateway';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { EmailProvider } from '../../../../domain/bounded-contexts/mailbox/email-provider.aggregate';
import { EmailCredentials } from '../../../../domain/bounded-contexts/mailbox/value-objects/email-credentials';
import { ProviderType } from '../../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

describe('RefreshProviderTokensHandler', () => {
  let handler: RefreshProviderTokensHandler;
  let mailboxRepo: InMemoryMailboxRepository;
  let providerRepo: InMemoryEmailProviderRepository;
  let gateway: FakeEmailProviderGateway;

  beforeEach(async () => {
    mailboxRepo = new InMemoryMailboxRepository();
    providerRepo = new InMemoryEmailProviderRepository();
    gateway = new FakeEmailProviderGateway();
    handler = new RefreshProviderTokensHandler(mailboxRepo, providerRepo, gateway);

    const m = Mailbox.create({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.GMAIL,
      emailAddress: 'a@gmail.com',
    });
    m.markConnected();
    await mailboxRepo.save(m);

    const creds = EmailCredentials.unsafeCreate('enc-1', 'iv-1');
    const p = EmailProvider.create({
      id: 'p-1',
      mailboxId: 'm-1',
      provider: ProviderType.GMAIL,
      credentials: creds,
      scopes: ['s-1'],
      expiresAt: new Date(Date.now() - 1000),
      refreshExpiresAt: new Date(Date.now() + 86400_000),
    });
    await providerRepo.save(p);

    gateway.setNextRefreshResponse({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: new Date(Date.now() + 3600_000),
    });
  });

  it('refreshes tokens for a connected provider', async () => {
    const result = await handler.execute({
      mailboxId: 'm-1',
      userId: 'u-1',
      refreshTokenPlaintext: 'old-refresh',
      encryptionKey: 'k-1',
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.expiresAt).not.toBeNull();
      expect(gateway.refreshCallCount).toBe(1);
    }
  });
});
