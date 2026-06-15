/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/export-workspace-data/export-workspace-data.handler.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Export workspace data for compliance
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { WORKSPACE_REPOSITORY, IWorkspaceRepository } from '../../../ports/repositories/workspace.repository';
import { MEMBERSHIP_REPOSITORY, IMembershipRepository } from '../../../ports/repositories/membership.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Workspace } from '../../../../domain/bounded-contexts/workspaces/workspace.aggregate';
import { ExportWorkspaceDataCommand } from './export-workspace-data.command';

@Injectable()
export class ExportWorkspaceDataHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private workspaceRepo: IWorkspaceRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private membershipRepo: IMembershipRepository,
  ) {}

  async execute(command: ExportWorkspaceDataCommand): Promise<Result<WorkspaceDataExportPayload, ApplicationError>> {
    const workspace = await this.workspaceRepo.findById(command.input.workspaceId);
    if (!workspace) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Workspace not found'));
    }

    const membership = await this.membershipRepo.findByWorkspaceAndEmail(
      workspace.id,
      command.input.actorUserId,
    );

    if (!membership) {
      return Result.err(new ApplicationError('FORBIDDEN', 'You do not have access to this workspace'));
    }

    if (!command.input.isAdmin && workspace.ownerUserId !== command.input.actorUserId) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Only the workspace owner can export data'));
    }

    const members = await this.membershipRepo.findByWorkspaceId(workspace.id);
    const memberCount = members.length;

    const payload = {
      generatedAtIso: new Date().toISOString(),
      dataJson: JSON.stringify({
        workspace: {
          id: workspace.id,
          ownerUserId: workspace.ownerUserId,
          name: workspace.name,
          slug: workspace.slug,
          isPersonal: workspace.isPersonal,
          createdAtIso: workspace.createdAt.toISOString(),
          updatedAtIso: workspace.updatedAt.toISOString(),
        },
        actor: {
          userId: command.input.actorUserId,
          isAdmin: command.input.isAdmin,
        },
        members: members.map(m => ({
          id: m.id,
          userId: m.userId,
          email: m.email,
          role: m.role,
          status: m.status,
          joinedAtIso: m.joinedAt?.toISOString() || null,
          invitedByUserId: m.invitedByUserId,
        })),
      }),
      memberCount,
    };

    return Result.ok(payload);
  }
}
