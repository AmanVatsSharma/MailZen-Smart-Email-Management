import { Resolver, Mutation, Args, Query, Context, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MailboxService } from './mailbox.service';
import {
  MailboxInboundEventObservabilityResponse,
  MailboxInboundEventStatsResponse,
  MailboxInboundEventTrendPointResponse,
} from './dto/mailbox-inbound-event-observability.response';

interface RequestContext {
  req: { user: { id: string } };
}

@Resolver('Mailbox')
@UseGuards(JwtAuthGuard)
export class MailboxResolver {
  constructor(private readonly mailboxService: MailboxService) {}

  @Mutation(() => String)
  async createMyMailbox(
    @Context() ctx: RequestContext,
    @Args('desiredLocalPart', { type: () => String, nullable: true })
    desiredLocalPart?: string,
  ) {
    const result = await this.mailboxService.createMailbox(
      ctx.req.user.id,
      desiredLocalPart,
    );
    return result.email;
  }

  @Query(() => [String])
  async myMailboxes(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Context() ctx: RequestContext,
  ) {
    const boxes = await this.mailboxService.getUserMailboxes(
      ctx.req.user.id,
      workspaceId,
    );
    return boxes.map((b) => b.email);
  }

  @Query(() => [MailboxInboundEventObservabilityResponse])
  async myMailboxInboundEvents(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('status', { nullable: true }) status?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<MailboxInboundEventObservabilityResponse[]> {
    return this.mailboxService.getInboundEvents(ctx.req.user.id, {
      mailboxId,
      workspaceId,
      status,
      limit,
    });
  }

  @Query(() => MailboxInboundEventStatsResponse)
  async myMailboxInboundEventStats(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<MailboxInboundEventStatsResponse> {
    return this.mailboxService.getInboundEventStats(ctx.req.user.id, {
      mailboxId,
      workspaceId,
      windowHours,
    });
  }

  @Query(() => [MailboxInboundEventTrendPointResponse])
  async myMailboxInboundEventSeries(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxInboundEventTrendPointResponse[]> {
    return this.mailboxService.getInboundEventSeries(ctx.req.user.id, {
      mailboxId,
      workspaceId,
      windowHours,
      bucketMinutes,
    });
  }
}
