/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/list-mailboxes/list-mailboxes.handler.ts
 * Module:      Mailbox · Use Case
 * Purpose:     List mailboxes by user or workspace. Re-shape of
 *              `mailbox.service.getUserMailboxes` / `getSharedMailboxes`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { Mailbox } from '../../../../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { MAILBOX_REPOSITORY, IMailboxRepository } from '../../../ports/repositories/mailbox.repository';

export interface ListMailboxesInput {
  userId: string;
  workspaceId?: string;
}

@Injectable()
export class ListMailboxesHandler {
  constructor(
    @Inject(MAILBOX_REPOSITORY)
    private readonly mailboxRepo: IMailboxRepository,
  ) {}

  async execute(input: ListMailboxesInput): Promise<Result<Mailbox[], never>> {
    if (input.workspaceId) {
      const mailboxes = await this.mailboxRepo.findByWorkspaceId(input.workspaceId);
      const userScoped = mailboxes.filter((m) => m.userId === input.userId);
      return makeResult(Result.ok(userScoped));
    }

    const mailboxes = await this.mailboxRepo.findByUserId(input.userId);
    return makeResult(Result.ok(mailboxes));
  }
}
