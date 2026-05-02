/**
 * File:        apps/backend/src/automation/guards/workspace-admin.guard.ts
 * Module:      Automation Engine · Guard
 * Purpose:     Allows only workspace ADMINs to execute protected mutations (create, update,
 *              enable, disable, archive automations). Reads workspaceId from the resolver
 *              args and validates the calling user's WorkspaceMember role.
 *
 * Exports:
 *   - WorkspaceAdminGuard  — Injectable NestJS guard
 *
 * Depends on:
 *   - WorkspaceMember entity  — looks up role by (workspaceId, userId)
 *   - @nestjs/graphql          — GqlExecutionContext for arg extraction
 *
 * Side-effects:
 *   - DB read (1 query per guarded call) to check workspace membership
 *
 * Key invariants:
 *   - Throws ForbiddenException for non-admins and non-members
 *   - workspaceId resolved from args.input.workspaceId → args.workspaceId → query param
 *   - Requires JwtAuthGuard to run first so req.user.id is populated
 *
 * Read order:
 *   1. WorkspaceAdminGuard.canActivate — the main logic
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember } from '../../workspace/entities/workspace-member.entity';

@Injectable()
export class WorkspaceAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlCtx = GqlExecutionContext.create(context);
    const req = gqlCtx.getContext().req;
    const userId: string | undefined = req?.user?.id;

    if (!userId) throw new ForbiddenException('Authentication required');

    const args = gqlCtx.getArgs<Record<string, Record<string, string>>>();
    const workspaceId =
      args?.['input']?.['workspaceId'] ??
      args?.['workspaceId'] ??
      req?.body?.variables?.workspaceId;

    if (!workspaceId) throw new ForbiddenException('workspaceId required');

    const member = await this.memberRepo.findOne({
      where: { workspaceId, userId },
    });

    if (!member) throw new ForbiddenException('Not a member of this workspace');
    if (member.role !== 'ADMIN') throw new ForbiddenException('Workspace admin access required');

    return true;
  }
}
