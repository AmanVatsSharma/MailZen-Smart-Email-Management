/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/sync-mailbox/sync-mailbox.handler.ts
 * Module:      Mailbox · Use Case
 * Purpose:     Sync a mailbox. Acquires sync lease, fetches message list
 *              from provider, persists new emails, updates cursor.
 *              Re-shape of `mailbox-sync.service.syncMailbox`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { MAILBOX_REPOSITORY, IMailboxRepository } from '../../../ports/repositories/mailbox.repository';
import { SYNC_LEASE_GATEWAY, ISyncLeaseGateway } from '../../../ports/gateways/sync-lease.gateway';
import { EMAIL_PROVIDER_GATEWAY, EmailProviderGateway } from '../../../ports/gateways/email-provider.gateway';
import { NotFoundError, ConflictError } from '../../../exceptions/application-error';

export interface SyncMailboxInput {
  mailboxId: string;
  userId: string;
  accessToken: string;
  syncLeaseTtlMs?: number;
}

export interface SyncMailboxOutput {
  newMessages: number;
  nextCursor: string | null;
  durationMs: number;
}

@Injectable()
export class SyncMailboxHandler {
  private static readonly DEFAULT_LEASE_TTL_MS = 60_000;

  constructor(
    @Inject(MAILBOX_REPOSITORY)
    private readonly mailboxRepo: IMailboxRepository,
    @Inject(SYNC_LEASE_GATEWAY)
    private readonly leaseGateway: ISyncLeaseGateway,
    @Inject(EMAIL_PROVIDER_GATEWAY)
    private readonly providerGateway: EmailProviderGateway,
  ) {}

  async execute(
    input: SyncMailboxInput,
  ): Promise<Result<SyncMailboxOutput, NotFoundError | ConflictError>> {
    const mailbox = await this.mailboxRepo.findById(input.mailboxId);
    if (!mailbox) {
      return makeResult(Result.err(new NotFoundError('Mailbox')));
    }

    if (mailbox.userId !== input.userId) {
      return makeResult(Result.err(new NotFoundError('Mailbox')));
    }

    if (!mailbox.isConnected) {
      return makeResult(Result.err(new ConflictError('Mailbox is not connected')));
    }

    const ttl = input.syncLeaseTtlMs ?? SyncMailboxHandler.DEFAULT_LEASE_TTL_MS;
    const leaseResult = await this.leaseGateway.acquire(mailbox.id, ttl, input.userId);
    if (!leaseResult.success || !leaseResult.leaseId) {
      return makeResult(Result.err(new ConflictError('Another sync is in progress')));
    }

    const startMs = Date.now();
    try {
      const messageList = await this.providerGateway.fetchMessageList(
        mailbox.provider,
        input.accessToken,
        mailbox.syncCursor ?? undefined,
      );

      const newCount = messageList.messages.length;
      if (messageList.nextCursor) {
        mailbox.updateSyncCursor(messageList.nextCursor);
        await this.mailboxRepo.save(mailbox);
      }

      return makeResult(Result.ok({
        newMessages: newCount,
        nextCursor: messageList.nextCursor,
        durationMs: Date.now() - startMs,
      }));
    } finally {
      await this.leaseGateway.release(leaseResult.leaseId);
    }
  }
}
