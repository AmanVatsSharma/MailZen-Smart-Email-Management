import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
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
    @Args('maxMessages', { nullable: true }) maxMessages: number | null,
    @Context() ctx: RequestContext,
  ) {
    await this.gmailSyncService.syncGmailProvider(providerId, ctx.req.user.id, maxMessages ?? 25);
    return true;
  }

  @Query(() => [InboxMessage])
  async getInboxMessages(
    @Args('inboxType') inboxType: 'PROVIDER' | 'MAILBOX',
    @Args('inboxId') inboxId: string,
    @Args('limit', { nullable: true }) limit: number | null,
    @Args('offset', { nullable: true }) offset: number | null,
    @Context() ctx: RequestContext,
  ) {
    // MVP: only PROVIDER is supported (Gmail messages live in ExternalEmailMessage).
    if (inboxType !== 'PROVIDER') return [];
    return this.gmailSyncService.listInboxMessagesForProvider(inboxId, ctx.req.user.id, limit ?? 50, offset ?? 0);
  }
}

