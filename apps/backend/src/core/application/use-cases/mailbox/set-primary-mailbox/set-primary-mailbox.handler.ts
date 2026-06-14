/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/set-primary-mailbox/set-primary-mailbox.handler.ts
 * Module:      Mailbox · Use Case
 * Purpose:     Set a mailbox as primary for the user. Demotes any
 *              previously primary mailbox. Re-shape of primary mailbox
 *              selection logic from existing codebase.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { MAILBOX_REPOSITORY, IMailboxRepository } from '../../../ports/repositories/mailbox.repository';
import { NotFoundError } from '../../../exceptions/application-error';

export interface SetPrimaryMailboxInput {
  mailboxId: string;
  userId: string;
}

@Injectable()
export class SetPrimaryMailboxHandler {
  constructor(
    @Inject(MAILBOX_REPOSITORY)
    private readonly mailboxRepo: IMailboxRepository,
  ) {}

  async execute(
    input: SetPrimaryMailboxInput,
  ): Promise<Result<Mailbox, NotFoundError>> {
    const target = await this.mailboxRepo.findById(input.mailboxId);
    if (!target) {
      return makeResult(Result.err(new NotFoundError('Mailbox')));
    }

    if (target.userId !== input.userId) {
      return makeResult(Result.err(new NotFoundError('Mailbox')));
    }

    const allUserMailboxes = await this.mailboxRepo.findByUserId(input.userId);
    const previousPrimary = allUserMailboxes.find((m) => m.isPrimary && m.id !== input.mailboxId);

    if (previousPrimary) {
      previousPrimary.unmarkPrimary();
      await this.mailboxRepo.save(previousPrimary);
    }

    target.markPrimary();
    await this.mailboxRepo.save(target);

    return makeResult(Result.ok(target));
  }
}
