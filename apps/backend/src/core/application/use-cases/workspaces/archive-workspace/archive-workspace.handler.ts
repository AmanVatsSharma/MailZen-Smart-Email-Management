/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/archive-workspace/archive-workspace.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Archive or unarchive a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { WORKSPACE_REPOSITORY, IWorkspaceRepository } from '../../ports/repositories/workspace.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { ArchiveWorkspaceCommand } from './archive-workspace.command';

@Injectable()
export class ArchiveWorkspaceHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private workspaceRepo: IWorkspaceRepository,
  ) {}

  async execute(command: ArchiveWorkspaceCommand): Promise<Result<string, ApplicationError>> {
    const workspace = await this.workspaceRepo.findById(command.input.workspaceId);
    if (!workspace) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Workspace not found'));
    }

    if (workspace.ownerUserId !== command.input.actorUserId) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Only the workspace owner can archive it'));
    }

    if (command.input.archive) {
      workspace.archive();
    } else {
      workspace.unarchive();
    }

    const saveResult = await this.workspaceRepo.save(workspace);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(workspace.id);
  }
}
