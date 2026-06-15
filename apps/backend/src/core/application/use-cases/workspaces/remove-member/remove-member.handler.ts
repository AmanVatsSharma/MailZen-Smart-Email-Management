/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/remove-member/remove-member.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Remove a member from a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { MEMBERSHIP_REPOSITORY, IMembershipRepository } from '../../../ports/repositories/membership.repository';
import { WORKSPACE_REPOSITORY, IWorkspaceRepository } from '../../../ports/repositories/workspace.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Membership } from '../../../../domain/bounded-contexts/workspaces/membership.aggregate';
import { Role } from '../../../../domain/bounded-contexts/workspaces/value-objects/role';
import { RemoveMemberCommand } from './remove-member.command';

@Injectable()
export class RemoveMemberHandler {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private membershipRepo: IMembershipRepository,
    @Inject(WORKSPACE_REPOSITORY) private workspaceRepo: IWorkspaceRepository,
  ) {}

  async execute(command: RemoveMemberCommand): Promise<Result<Membership, ApplicationError>> {
    const membership = await this.membershipRepo.findById(command.input.membershipId);
    if (!membership) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Member not found'));
    }

    const actorMembership = await this.membershipRepo.findByWorkspaceAndEmail(
      membership.workspaceId,
      command.input.actorUserId,
    );

    if (!actorMembership || (actorMembership.role !== Role.OWNER && actorMembership.role !== Role.ADMIN)) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Only OWNER/ADMIN can remove members'));
    }

    if (membership.role === Role.OWNER && actorMembership.role !== Role.OWNER) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Only OWNER can remove an OWNER'));
    }

    if (membership.role === Role.OWNER) {
      const owners = await this.membershipRepo.findOwnersByWorkspaceId(membership.workspaceId);
      const activeOwners = owners.filter(o => o.status === 'active' && o.role === Role.OWNER);
      if (activeOwners.length <= 1) {
        return Result.err(new ApplicationError('CONFLICT', 'Workspace must always have one OWNER'));
      }
    }

    membership.remove();
    const save = await this.membershipRepo.save(membership);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    if (membership.userId) {
      await this.workspaceRepo.updateActiveWorkspace(membership.userId, null);
    }

    return Result.ok(membership);
  }
}
