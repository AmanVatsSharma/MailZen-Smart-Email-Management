import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Inbox } from './entities/inbox.entity';
import { InboxService } from './inbox.service';
import { SetActiveInboxInput } from './dto/set-active-inbox.input';
import { InboxSyncRunResponse } from './entities/inbox-sync-run-response.entity';
import { InboxSourceHealthStatsResponse } from './entities/inbox-source-health-stats.response';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => Inbox)
@UseGuards(JwtAuthGuard)
export class InboxResolver {
  constructor(private readonly inboxService: InboxService) {}

  @Query(() => [Inbox])
  async myInboxes(@Context() ctx: RequestContext) {
    return this.inboxService.listUserInboxes(ctx.req.user.id);
  }

  @Mutation(() => [Inbox])
  async setActiveInbox(
    @Args('input') input: SetActiveInboxInput,
    @Context() ctx: RequestContext,
  ) {
    return this.inboxService.setActiveInbox(
      ctx.req.user.id,
      input.type,
      input.id,
    );
  }

  @Mutation(() => InboxSyncRunResponse)
  async syncMyInboxes(
    @Args('workspaceId', { nullable: true }) workspaceId: string | null,
    @Context() ctx: RequestContext,
  ) {
    return this.inboxService.syncUserInboxes({
      userId: ctx.req.user.id,
      workspaceId,
    });
  }

  @Query(() => InboxSourceHealthStatsResponse)
  async myInboxSourceHealthStats(
    @Args('workspaceId', { nullable: true }) workspaceId: string | null,
    @Args('windowHours', { nullable: true }) windowHours: number | null,
    @Context() ctx: RequestContext,
  ) {
    return this.inboxService.getInboxSourceHealthStats({
      userId: ctx.req.user.id,
      workspaceId,
      windowHours,
    });
  }
}
