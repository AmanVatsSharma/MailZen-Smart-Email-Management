/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/connect-mailbox/connect-mailbox.handler.spec.ts
 * Module:      Mailbox · Use Case · Test
 * Purpose:     Unit tests for ConnectMailboxHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ConnectMailboxHandler } from './connect-mailbox.handler';
import { InMemoryMailboxRepository } from '../../../../testing/in-memory-mailbox.repository';
import { InMemoryEmailProviderRepository } from '../../../../testing/in-memory-email-provider.repository';
import { ProviderType } from '../../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

describe('ConnectMailboxHandler', () => {
  let handler: ConnectMailboxHandler;
  let mailboxRepo: InMemoryMailboxRepository;
  let providerRepo: InMemoryEmailProviderRepository;

  beforeEach(() => {
    mailboxRepo = new InMemoryMailboxRepository();
    providerRepo = new InMemoryEmailProviderRepository();
    handler = new ConnectMailboxHandler(mailboxRepo, providerRepo);
  });

  it('connects a new mailbox', async () => {
    const result = await handler.execute({
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.GMAIL,
      emailAddress: 'user@gmail.com',
      encryptedAccessToken: 'enc-acc',
      encryptedAccessTokenIv: 'iv-1',
      encryptedRefreshToken: 'enc-ref',
      encryptedRefreshTokenIv: 'iv-2',
      scopes: ['https://mail.google.com/'],
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      refreshTokenExpiresAt: new Date(Date.now() + 86400_000),
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.mailbox.isConnected).toBe(true);
      expect(result.value.provider.id).toBeDefined();
    }
  });

  it('rejects a duplicate connection', async () => {
    const input = {
      workspaceId: 'ws-1',
      userId: 'u-1',
      provider: ProviderType.GMAIL,
      emailAddress: 'user@gmail.com',
      encryptedAccessToken: 'enc-acc',
      encryptedAccessTokenIv: 'iv-1',
      encryptedRefreshToken: 'enc-ref',
      encryptedRefreshTokenIv: 'iv-2',
      scopes: ['https://mail.google.com/'],
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      refreshTokenExpiresAt: new Date(Date.now() + 86400_000),
    };

    await handler.execute(input);
    const result = await handler.execute(input);
    expect(result.isErr()).toBe(true);
  });
});
