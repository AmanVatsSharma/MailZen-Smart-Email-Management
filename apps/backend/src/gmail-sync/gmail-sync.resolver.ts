import { Args, Context, Mutation, Query, Resolver, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InboxMessage } from './entities/inbox-message.entity';
import { GmailSyncService } from './gmail-sync.service';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => InboxMessage)
@UseGuards(JwtAuthGuard)
export class GmailSyncResolver {
  constructor(private readonly gmailSyncService: GmailSyncService) {}

  @Mutation(() => Boolean)
  async syncGmailProvider(
    @Args('providerId') providerId: string,
    @Args('maxMessages', { type: () => Int, nullable: true })
    maxMessages: number,
    @Context() ctx: RequestContext,
  ) {
    await this.gmailSyncService.syncGmailProvider(
      providerId,
      ctx.req.user.id,
      maxMessages ?? 25,
    );
    return true;
  }

  @Query(() => [InboxMessage])
  async getInboxMessages(
    @Args('inboxType', { type: () => String }) inboxType: string,
    @Args('inboxId') inboxId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Args('offset', { type: () => Int, nullable: true }) offset: number,
    @Context() ctx: RequestContext,
  ) {
    // MVP: only PROVIDER is supported (Gmail messages live in ExternalEmailMessage).
    if (inboxType !== 'PROVIDER') return [];
    return this.gmailSyncService.listInboxMessagesForProvider(
      inboxId,
      ctx.req.user.id,
      limit ?? 50,
      offset ?? 0,
    );
  }
}
