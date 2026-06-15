/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/add-member/add-member.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Add a new member to a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { WORKSPACE_REPOSITORY, IWorkspaceRepository } from '../../../ports/repositories/workspace.repository';
import { MEMBERSHIP_REPOSITORY, IMembershipRepository } from '../../../ports/repositories/membership.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Membership } from '../../../../domain/bounded-contexts/workspaces/membership.aggregate';
import { AddMemberCommand } from './add-member.command';

@Injectable()
export class AddMemberHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private workspaceRepo: IWorkspaceRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: AddMemberCommand): Promise<Result<Membership, ApplicationError>> {
    if (!command.input.email || !command.input.email.includes('@')) {
      return Result.err(new ApplicationError('INVALID_EMAIL', 'Valid member email is required'));
    }

    const workspace = await this.workspaceRepo.findById(command.input.workspaceId);
    if (!workspace) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Workspace not found'));
    }

    const existing = await this.membershipRepo.findByWorkspaceAndEmail(
      command.input.workspaceId,
      command.input.email.toLowerCase(),
    );

    if (existing) {
      const canReactivate = ['declined', 'removed'].includes(existing.status);
      if (!canReactivate) {
        return Result.ok(existing);
      }
      const reactivateResult = existing.accept(existing.userId || 'pending');
      if (reactivateResult) {
        const roleChange = existing.changeRole(command.input.role);
        if (roleChange.isErr()) {
          return Result.err(new ApplicationError('INVALID_ROLE', roleChange.error.message));
        }
        const save = await this.membershipRepo.save(existing);
        if (save.isErr()) {
          return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
        }
      }
      return Result.ok(existing);
    }

    const membershipResult = Membership.create({
      workspaceId: command.input.workspaceId,
      userId: null,
      email: command.input.email.toLowerCase(),
      role: command.input.role,
      status: 'pending',
      invitedByUserId: command.input.actorUserId,
    });

    if (membershipResult.isErr()) {
      return Result.err(new ApplicationError('CREATE_FAILED', membershipResult.error.message));
    }

    const save = await this.membershipRepo.save(membershipResult.value);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    return Result.ok(membershipResult.value);
  }
}
