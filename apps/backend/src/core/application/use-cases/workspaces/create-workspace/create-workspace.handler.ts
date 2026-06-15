/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/create-workspace/create-workspace.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Create a new workspace for a user
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { WORKSPACE_REPOSITORY, IWorkspaceRepository } from '../../../ports/repositories/workspace.repository';
import { MEMBERSHIP_REPOSITORY, IMembershipRepository } from '../../../ports/repositories/membership.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { CreateWorkspaceCommand } from './create-workspace.command';
import { Workspace } from '../../../../domain/bounded-contexts/workspaces/workspace.aggregate';
import { Membership } from '../../../../domain/bounded-contexts/workspaces/membership.aggregate';
import { Role } from '../../../../domain/bounded-contexts/workspaces/value-objects/role';

@Injectable()
export class CreateWorkspaceHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private workspaceRepo: IWorkspaceRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: CreateWorkspaceCommand): Promise<Result<string, ApplicationError>> {
    if (!command.input.name || command.input.name.trim().length < 2) {
      return Result.err(new ApplicationError('INVALID_NAME', 'Workspace name must be at least 2 characters'));
    }

    const slug = await this.generateUniqueSlug(command.input.name);

    const workspaceResult = Workspace.create({
      name: command.input.name.trim(),
      slug,
      ownerUserId: command.input.userId,
      isPersonal: false,
      automationsEnabled: false,
      automationConcurrencyCap: 20,
      autoSendEnabled: false,
    });

    if (workspaceResult.isErr()) {
      return Result.err(new ApplicationError('WORKSPACE_CREATE_FAILED', workspaceResult.error.message));
    }

    const workspace = workspaceResult.value;
    const saveResult = await this.workspaceRepo.save(workspace);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('WORKSPACE_SAVE_FAILED', saveResult.error.message));
    }

    const membershipResult = Membership.create({
      workspaceId: workspace.id,
      userId: command.input.userId,
      email: command.input.userId,
      role: Role.OWNER,
      status: 'active',
      invitedByUserId: command.input.userId,
      joinedAt: new Date(),
    });

    if (membershipResult.isErr()) {
      return Result.err(new ApplicationError('MEMBERSHIP_CREATE_FAILED', membershipResult.error.message));
    }

    const memberSave = await this.membershipRepo.save(membershipResult.value);
    if (memberSave.isErr()) {
      return Result.err(new ApplicationError('MEMBERSHIP_SAVE_FAILED', memberSave.error.message));
    }

    return Result.ok(workspace.id);
  }

  private async generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = slugify(baseName);
    let slug = baseSlug;
    let suffix = 0;

    while (await this.workspaceRepo.existsWithSlug(slug)) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return slug;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
