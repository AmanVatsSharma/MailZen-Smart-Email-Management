import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceService } from './workspace.service';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => Workspace)
@UseGuards(JwtAuthGuard)
export class WorkspaceResolver {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Query(() => [Workspace], {
    description: 'List workspaces for current user',
  })
  async myWorkspaces(@Context() context: RequestContext) {
    return this.workspaceService.listMyWorkspaces(context.req.user.id);
  }

  @Query(() => Workspace, {
    nullable: true,
    description: 'Get active workspace for current user',
  })
  async myActiveWorkspace(@Context() context: RequestContext) {
    return this.workspaceService.getActiveWorkspace(context.req.user.id);
  }

  @Mutation(() => Workspace, {
    description: 'Create a new workspace for current user',
  })
  async createWorkspace(
    @Args('name') name: string,
    @Context() context: RequestContext,
  ) {
    return this.workspaceService.createWorkspace(context.req.user.id, name);
  }

  @Query(() => [WorkspaceMember], {
    description: 'List members of a workspace the user belongs to',
  })
  async workspaceMembers(
    @Args('workspaceId') workspaceId: string,
    @Context() context: RequestContext,
  ) {
    return this.workspaceService.listWorkspaceMembers(
      workspaceId,
      context.req.user.id,
    );
  }

  @Query(() => [WorkspaceMember], {
    description: 'List pending workspace invitations for current user email',
  })
  async myPendingWorkspaceInvitations(@Context() context: RequestContext) {
    return this.workspaceService.listPendingWorkspaceInvitations(
      context.req.user.id,
    );
  }

  @Mutation(() => WorkspaceMember, {
    description: 'Invite member to workspace',
  })
  async inviteWorkspaceMember(
    @Args('workspaceId') workspaceId: string,
    @Args('email') email: string,
    @Args('role', { nullable: true }) role: string,
    @Context() context: RequestContext,
  ) {
    return this.workspaceService.inviteWorkspaceMember(
      workspaceId,
      context.req.user.id,
      email,
      role || 'MEMBER',
    );
  }

  @Mutation(() => Workspace, {
    description: 'Set active workspace for current user',
  })
  async setActiveWorkspace(
    @Args('workspaceId') workspaceId: string,
    @Context() context: RequestContext,
  ) {
    return this.workspaceService.setActiveWorkspace(
      context.req.user.id,
      workspaceId,
    );
  }

  @Mutation(() => WorkspaceMember, {
    description: 'Accept or decline pending workspace invitation',
  })
  async respondWorkspaceInvitation(
    @Args('workspaceMemberId') workspaceMemberId: string,
    @Args('accept', { type: () => Boolean }) accept: boolean,
    @Context() context: RequestContext,
  ) {
    return this.workspaceService.respondToWorkspaceInvitation({
      workspaceMemberId,
      userId: context.req.user.id,
      accept,
    });
  }
}
