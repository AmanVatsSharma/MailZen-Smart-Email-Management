import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailThread } from './entities/email-thread.entity';
import { UnifiedInboxService } from './unified-inbox.service';
import { EmailFilterInput } from './dto/email-filter.input';
import { EmailSortInput } from './dto/email-sort.input';
import { EmailUpdateInput } from './dto/email-update.input';
import { EmailFolder } from './entities/email-folder.entity';
import { EmailLabel } from './entities/email-label.entity';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver()
@UseGuards(JwtAuthGuard)
export class UnifiedInboxResolver {
  constructor(private readonly unifiedInbox: UnifiedInboxService) {}

  /**
   * Frontend contract: `emails(...)` used by the inbox list UI.
   *
   * Returns thread-shaped records (not the internal `Email` model).
   */
  @Query(() => [EmailThread])
  async emails(
    @Args('limit', { nullable: true }) limit: number | null,
    @Args('offset', { nullable: true }) offset: number | null,
    @Args('filter', { nullable: true }) filter: EmailFilterInput | null,
    @Args('sort', { nullable: true }) sort: EmailSortInput | null,
    @Context() ctx: RequestContext,
  ) {
    return this.unifiedInbox.listThreads(ctx.req.user.id, limit ?? 10, offset ?? 0, filter, sort);
  }

  /**
   * Frontend contract: `email(id)` used by detail view.
   */
  @Query(() => EmailThread)
  async email(@Args('id') id: string, @Context() ctx: RequestContext) {
    return this.unifiedInbox.getThread(ctx.req.user.id, id);
  }

  /**
   * Frontend contract: `updateEmail(id, input)` used by batch actions & detail.
   */
  @Mutation(() => EmailThread)
  async updateEmail(@Args('id') id: string, @Args('input') input: EmailUpdateInput, @Context() ctx: RequestContext) {
    return this.unifiedInbox.updateThread(ctx.req.user.id, id, input);
  }

  @Query(() => [EmailFolder])
  async folders(@Context() ctx: RequestContext) {
    return this.unifiedInbox.listFolders(ctx.req.user.id);
  }

  @Query(() => [EmailLabel])
  async labels(@Context() ctx: RequestContext) {
    return this.unifiedInbox.listLabels(ctx.req.user.id);
  }
}

