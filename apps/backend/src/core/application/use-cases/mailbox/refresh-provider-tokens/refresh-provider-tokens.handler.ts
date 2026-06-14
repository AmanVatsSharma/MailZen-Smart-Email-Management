/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/refresh-provider-tokens/refresh-provider-tokens.handler.ts
 * Module:      Mailbox · Use Case
 * Purpose:     Refresh OAuth tokens for a connected mailbox. Looks up
 *              the EmailProvider, calls the provider's refresh endpoint,
 *              and persists the new credentials.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { EmailProvider } from '../../../../domain/bounded-contexts/mailbox/email-provider.aggregate';
import { EmailCredentials } from '../../../../domain/bounded-contexts/mailbox/value-objects/email-credentials';
import { MAILBOX_REPOSITORY, IMailboxRepository } from '../../../ports/repositories/mailbox.repository';
import { EMAIL_PROVIDER_REPOSITORY, IEmailProviderRepository } from '../../../ports/repositories/email-provider.repository';
import { EMAIL_PROVIDER_GATEWAY, EmailProviderGateway } from '../../../ports/gateways/email-provider.gateway';
import { NotFoundError, ApplicationError } from '../../../exceptions/application-error';

export interface RefreshProviderTokensInput {
  mailboxId: string;
  userId: string;
  refreshTokenPlaintext: string;
  encryptionKey: string;
}

@Injectable()
export class RefreshProviderTokensHandler {
  constructor(
    @Inject(MAILBOX_REPOSITORY)
    private readonly mailboxRepo: IMailboxRepository,
    @Inject(EMAIL_PROVIDER_REPOSITORY)
    private readonly providerRepo: IEmailProviderRepository,
    @Inject(EMAIL_PROVIDER_GATEWAY)
    private readonly providerGateway: EmailProviderGateway,
  ) {}

  async execute(
    input: RefreshProviderTokensInput,
  ): Promise<Result<EmailProvider, NotFoundError | ApplicationError>> {
    const mailbox = await this.mailboxRepo.findById(input.mailboxId);
    if (!mailbox || mailbox.userId !== input.userId) {
      return makeResult(Result.err(new NotFoundError('Mailbox')));
    }

    const provider = await this.providerRepo.findByMailboxId(mailbox.id);
    if (!provider) {
      return makeResult(Result.err(new NotFoundError('EmailProvider')));
    }

    try {
      const refreshResult = await this.providerGateway.refreshToken(
        mailbox.provider,
        input.refreshTokenPlaintext,
      );

      const encryptedAccessResult = EmailCredentials.create(
        refreshResult.accessToken,
        input.encryptionKey,
      );
      if (!encryptedAccessResult.isOk()) {
        return makeResult(Result.err(new ApplicationError('ENCRYPTION', 'Failed to encrypt new access token')));
      }

      provider.rotateCredentials(
        encryptedAccessResult.value,
        refreshResult.expiresAt,
        null,
      );
      await this.providerRepo.save(provider);

      return makeResult(Result.ok(provider));
    } catch (e) {
      return makeResult(Result.err(new ApplicationError(
        'PROVIDER_REFRESH_FAILED',
        e instanceof Error ? e.message : 'Unknown error',
      )));
    }
  }
}
