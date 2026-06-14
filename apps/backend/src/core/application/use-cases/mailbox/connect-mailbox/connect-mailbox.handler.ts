/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/connect-mailbox/connect-mailbox.handler.ts
 * Module:      Mailbox · Use Case
 * Purpose:     Connect a mailbox to an email provider. Stores OAuth
 *              tokens, creates an EmailProvider record, marks mailbox
 *              as connected. Behavior-preserving re-shape of
 *              `mailbox.service.connectMailbox`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Result, makeResult } from '../../../../domain/shared/result';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { EmailProvider } from '../../../../domain/bounded-contexts/mailbox/email-provider.aggregate';
import { EmailCredentials } from '../../../../domain/bounded-contexts/mailbox/value-objects/email-credentials';
import { ProviderType } from '../../../../domain/bounded-contexts/mailbox/value-objects/provider-type';
import { MAILBOX_REPOSITORY, IMailboxRepository } from '../../../ports/repositories/mailbox.repository';
import { EMAIL_PROVIDER_REPOSITORY, IEmailProviderRepository } from '../../../ports/repositories/email-provider.repository';
import { ApplicationError, NotFoundError, ConflictError } from '../../../exceptions/application-error';

export interface ConnectMailboxInput {
  workspaceId: string;
  userId: string;
  provider: ProviderType;
  emailAddress: string;
  encryptedAccessToken: string;
  encryptedAccessTokenIv: string;
  encryptedRefreshToken: string;
  encryptedRefreshTokenIv: string;
  scopes: string[];
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  mailboxId?: string;
}

export interface ConnectMailboxOutput {
  mailbox: Mailbox;
  provider: EmailProvider;
}

@Injectable()
export class ConnectMailboxHandler {
  constructor(
    @Inject(MAILBOX_REPOSITORY)
    private readonly mailboxRepo: IMailboxRepository,
    @Inject(EMAIL_PROVIDER_REPOSITORY)
    private readonly providerRepo: IEmailProviderRepository,
  ) {}

  async execute(
    input: ConnectMailboxInput,
  ): Promise<Result<ConnectMailboxOutput, ApplicationError>> {
    const existing = await this.mailboxRepo.findByProvider(input.provider, input.emailAddress);
    if (existing && existing.isConnected) {
      return makeResult(Result.err(new ConflictError('Mailbox already connected')));
    }

    const accessCredsResult = EmailCredentials.create(
      input.encryptedAccessToken,
      input.encryptedAccessTokenIv,
    );
    if (!accessCredsResult.isOk()) {
      return makeResult(Result.err(new ConflictError('Invalid access token encryption')));
    }

    const refreshCredsResult = EmailCredentials.create(
      input.encryptedRefreshToken,
      input.encryptedRefreshTokenIv,
    );
    if (!refreshCredsResult.isOk()) {
      return makeResult(Result.err(new ConflictError('Invalid refresh token encryption')));
    }

    const mailbox = existing ?? Mailbox.create({
      id: input.mailboxId ?? randomUUID(),
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: input.provider,
      emailAddress: input.emailAddress,
    });

    const provider = EmailProvider.create({
      id: randomUUID(),
      mailboxId: mailbox.id,
      provider: input.provider,
      credentials: accessCredsResult.value,
      scopes: input.scopes,
      expiresAt: input.accessTokenExpiresAt,
      refreshExpiresAt: input.refreshTokenExpiresAt,
    });

    mailbox.markConnected();
    await this.mailboxRepo.save(mailbox);
    await this.providerRepo.save(provider);

    return makeResult(Result.ok({ mailbox, provider }));
  }
}
