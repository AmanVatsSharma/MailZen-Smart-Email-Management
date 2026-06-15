/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/rename-workspace/rename-workspace.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Rename a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { WORKSPACE_REPOSITORY, IWorkspaceRepository } from '../../../ports/repositories/workspace.repository';
import { MEMBERSHIP_REPOSITORY, IMembershipRepository } from '../../../ports/repositories/membership.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Workspace } from '../../../../domain/bounded-contexts/workspaces/workspace.aggregate';
import { RenameWorkspaceCommand } from './rename-workspace.command';

@Injectable()
export class RenameWorkspaceHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private workspaceRepo: IWorkspaceRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: RenameWorkspaceCommand): Promise<Result<Workspace, ApplicationError>> {
    const workspace = await this.workspaceRepo.findById(command.input.workspaceId);
    if (!workspace) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Workspace not found'));
    }

    const isOwner = await this.isWorkspaceOwner(workspace.id, command.input.actorUserId);
    if (!isOwner) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Only the workspace owner can rename it'));
    }

    const renameResult = workspace.rename(command.input.newName);
    if (renameResult.isErr()) {
      return Result.err(new ApplicationError('INVALID_NAME', renameResult.error.message));
    }

    const saveResult = await this.workspaceRepo.save(workspace);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(workspace);
  }

  private async isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
    const ws = await this.workspaceRepo.findById(workspaceId);
    return ws?.ownerUserId === userId;
  }
}
