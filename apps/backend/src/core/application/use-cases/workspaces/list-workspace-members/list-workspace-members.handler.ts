/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/list-workspace-members/list-workspace-members.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     List all members of a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { WORKSPACE_REPOSITORY, IWorkspaceRepository } from '../../../ports/repositories/workspace.repository';
import { MEMBERSHIP_REPOSITORY, IMembershipRepository } from '../../../ports/repositories/membership.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Membership } from '../../../../domain/bounded-contexts/workspaces/membership.aggregate';
import { ListWorkspaceMembersCommand } from './list-workspace-members.command';

@Injectable()
export class ListWorkspaceMembersHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private workspaceRepo: IWorkspaceRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: ListWorkspaceMembersCommand): Promise<Result<Membership[], ApplicationError>> {
    const workspace = await this.workspaceRepo.findById(command.input.workspaceId);
    if (!workspace) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Workspace not found'));
    }

    const members = await this.membershipRepo.findByWorkspaceId(command.input.workspaceId);
    return Result.ok(members);
  }
}
