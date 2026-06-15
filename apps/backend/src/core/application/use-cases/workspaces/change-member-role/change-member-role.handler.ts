/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/change-member-role/change-member-role.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Change a member's role
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { MEMBERSHIP_REPOSITORY, IMembershipRepository } from '../../../ports/repositories/membership.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Membership } from '../../../../domain/bounded-contexts/workspaces/membership.aggregate';
import { Role } from '../../../../domain/bounded-contexts/workspaces/value-objects/role';
import { ChangeMemberRoleCommand } from './change-member-role.command';

@Injectable()
export class ChangeMemberRoleHandler {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: ChangeMemberRoleCommand): Promise<Result<Membership, ApplicationError>> {
    const membership = await this.membershipRepo.findById(command.input.membershipId);
    if (!membership) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Member not found'));
    }

    const actorMembership = await this.membershipRepo.findByWorkspaceAndEmail(
      membership.workspaceId,
      command.input.actorUserId,
    );

    if (!actorMembership || (actorMembership.role !== Role.OWNER && actorMembership.role !== Role.ADMIN)) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Only OWNER/ADMIN can change roles'));
    }

    if (command.input.newRole === Role.OWNER && actorMembership.role !== Role.OWNER) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Only OWNER can promote to OWNER'));
    }

    if (membership.role === Role.OWNER && command.input.newRole !== Role.OWNER) {
      const owners = await this.membershipRepo.findOwnersByWorkspaceId(membership.workspaceId);
      const activeOwners = owners.filter(o => o.status === 'active' && o.role === Role.OWNER);
      if (activeOwners.length <= 1) {
        return Result.err(new ApplicationError('CONFLICT', 'Workspace must always have one OWNER'));
      }
    }

    const roleChange = membership.changeRole(command.input.newRole);
    if (roleChange.isErr()) {
      return Result.err(new ApplicationError('INVALID_ROLE', roleChange.error.message));
    }

    const save = await this.membershipRepo.save(membership);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    return Result.ok(membership);
  }
}
