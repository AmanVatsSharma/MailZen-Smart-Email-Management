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
}
