/**
 * File:        apps/backend/src/core/application/use-cases/unified-inbox/list-threads/list-threads.handler.ts
 * Module:      Unified Inbox Use Cases
 * Purpose:     List unified threads (across providers) for a user in a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { UNIFIED_THREAD_REPOSITORY, IUnifiedThreadRepository } from '../../ports/repositories/unified-inbox.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { UnifiedThread } from '../../../../domain/bounded-contexts/unified-inbox/unified-thread.aggregate';
import { UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { ListThreadsCommand } from './list-threads.command';

export interface ListThreadsResult {
  items: UnifiedThread[];
  total: number;
}

@Injectable()
export class ListThreadsHandler {
  constructor(
    @Inject(UNIFIED_THREAD_REPOSITORY)
    private threadRepo: IUnifiedThreadRepository,
  ) {}

  async execute(command: ListThreadsCommand): Promise<Result<ListThreadsResult, ApplicationError>> {
    if (!command.input.userId || !command.input.workspaceId) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'userId and workspaceId are required'));
    }

    const limit = Math.max(1, Math.min(command.input.limit ?? 50, 200));
    const offset = Math.max(0, command.input.offset ?? 0);

    const page = await this.threadRepo.listForUser({
      userId: UserId.from(command.input.userId),
      workspaceId: WorkspaceId.from(command.input.workspaceId),
      folderId: command.input.folderId,
      limit,
      offset,
    });

    return Result.ok(page);
  }
}
