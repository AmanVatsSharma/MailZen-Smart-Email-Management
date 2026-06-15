/**
 * File:        apps/backend/src/core/application/use-cases/unified-inbox/mark-read/mark-read.handler.ts
 * Module:      Unified Inbox Use Cases
 * Purpose:     Mark a unified thread as read for a user
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { UNIFIED_THREAD_REPOSITORY, IUnifiedThreadRepository } from '../../../ports/repositories/unified-inbox.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { UnifiedThread } from '../../../../domain/bounded-contexts/unified-inbox/unified-thread.aggregate';
import { MarkThreadReadCommand } from './mark-read.command';

@Injectable()
export class MarkThreadReadHandler {
  constructor(
    @Inject(UNIFIED_THREAD_REPOSITORY)
    private threadRepo: IUnifiedThreadRepository,
  ) {}

  async execute(command: MarkThreadReadCommand): Promise<Result<UnifiedThread, ApplicationError>> {
    const thread = await this.threadRepo.findById(command.input.id);
    if (!thread) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Thread not found'));
    }

    if (thread.userId !== command.input.userId) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Cannot mark another user\'s thread as read'));
    }

    const updated = thread.markRead();
    const saveResult = await this.threadRepo.save(updated);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(updated);
  }
}
