/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/disconnect-mailbox/disconnect-mailbox.handler.ts
 * Module:      Mailbox · Use Case
 * Purpose:     Disconnect a mailbox from its provider. Marks mailbox
 *              as disconnected, clears sync state. Preserves behavior
 *              from `mailbox.service.disconnectMailbox`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { MAILBOX_REPOSITORY, IMailboxRepository } from '../../../ports/repositories/mailbox.repository';
import { NotFoundError } from '../../../exceptions/application-error';

export interface DisconnectMailboxInput {
  mailboxId: string;
  userId: string;
  reason: string;
}

@Injectable()
export class DisconnectMailboxHandler {
  constructor(
    @Inject(MAILBOX_REPOSITORY)
    private readonly mailboxRepo: IMailboxRepository,
  ) {}

  async execute(
    input: DisconnectMailboxInput,
  ): Promise<Result<Mailbox, NotFoundError>> {
    const mailbox = await this.mailboxRepo.findById(input.mailboxId);
    if (!mailbox) {
      return makeResult(Result.err(new NotFoundError('Mailbox')));
    }

    if (mailbox.userId !== input.userId) {
      return makeResult(Result.err(new NotFoundError('Mailbox')));
    }

    mailbox.markDisconnected(input.reason);
    await this.mailboxRepo.save(mailbox);

    return makeResult(Result.ok(mailbox));
  }
}
