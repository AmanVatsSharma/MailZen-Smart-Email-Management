/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/transfer-ownership/transfer-ownership.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Transfer workspace ownership to another user
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { WORKSPACE_REPOSITORY, IWorkspaceRepository } from '../../../ports/repositories/workspace.repository';
import { MEMBERSHIP_REPOSITORY, IMembershipRepository } from '../../../ports/repositories/membership.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Workspace } from '../../../../domain/bounded-contexts/workspaces/workspace.aggregate';
import { TransferOwnershipCommand } from './transfer-ownership.command';

@Injectable()
export class TransferOwnershipHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private workspaceRepo: IWorkspaceRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: TransferOwnershipCommand): Promise<Result<Workspace, ApplicationError>> {
    const workspace = await this.workspaceRepo.findById(command.input.workspaceId);
    if (!workspace) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Workspace not found'));
    }

    if (workspace.ownerUserId !== command.input.actorUserId) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Only the current owner can transfer ownership'));
    }

    const newOwnerMembership = await this.membershipRepo.findByWorkspaceAndEmail(
      workspace.id,
      command.input.newOwnerUserId,
    );
    if (!newOwnerMembership) {
      return Result.err(new ApplicationError('NOT_MEMBER', 'The new owner must already be a workspace member'));
    }

    const transferResult = workspace.transferOwnership(command.input.newOwnerUserId);
    if (transferResult.isErr()) {
      return Result.err(new ApplicationError('TRANSFER_FAILED', transferResult.error.message));
    }

    const saveResult = await this.workspaceRepo.save(workspace);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(workspace);
  }
}
