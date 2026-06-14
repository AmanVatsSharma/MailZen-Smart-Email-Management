/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-inbox/list-inbox.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     ListInbox use case. Paginates emails by workspace, optionally
 *              filtered by status or threadId.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { IEmailRepository, EMAIL_REPOSITORY } from '../../../ports/repositories/email.repository';
import { WorkspaceId, ThreadId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ListInboxInput, ListInboxOutput } from './list-inbox.dto';

export const LIST_INBOX_HANDLER = Symbol('ListInboxHandler');

export class ListInboxHandler {
  constructor(private readonly emails: IEmailRepository) {}

  async execute(input: ListInboxInput): Promise<Result<ListInboxOutput, Error>> {
    const page = await this.emails.list({
      workspaceId: WorkspaceId.from(input.workspaceId),
      status: input.status,
      threadId: input.threadId ? ThreadId.from(input.threadId) : undefined,
      limit: input.limit,
      offset: input.offset,
    });
    return makeResult(Result.ok({
      items: page.items.map((e) => ({
        id: e.id, subject: e.subject, status: e.status, threadId: e.threadId,
      })),
      total: page.total,
    }));
  }
}
