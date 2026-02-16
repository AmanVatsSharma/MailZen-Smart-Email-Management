import { Resolver, Mutation, Args, Query, Context, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MailboxService } from './mailbox.service';
import { MailboxSyncService } from './mailbox-sync.service';
import { MailboxInboundDataExportResponse } from './dto/mailbox-inbound-data-export.response';
import {
  MailboxInboundEventObservabilityResponse,
  MailboxInboundEventStatsResponse,
  MailboxInboundEventTrendPointResponse,
} from './dto/mailbox-inbound-event-observability.response';
import { MailboxInboundRetentionPurgeResponse } from './dto/mailbox-inbound-retention-purge.response';
import { MailboxSyncStateResponse } from './dto/mailbox-sync-state.response';
import { MailboxSyncRunResponse } from './dto/mailbox-sync-run.response';
import { MailboxProvisioningHealthResponse } from './dto/mailbox-provisioning-health.response';

interface RequestContext {
  req: { user: { id: string } };
}

@Resolver('Mailbox')
@UseGuards(JwtAuthGuard)
export class MailboxResolver {
  constructor(
    private readonly mailboxService: MailboxService,
    private readonly mailboxSyncService: MailboxSyncService,
  ) {}

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

  @Query(() => MailboxProvisioningHealthResponse, {
    description:
      'Get mailbox provisioning admin API readiness and failover configuration',
  })
  myMailboxProvisioningHealth(): MailboxProvisioningHealthResponse {
    return this.mailboxService.getProvisioningHealthSummary();
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

  @Query(() => MailboxInboundDataExportResponse)
  async myMailboxInboundDataExport(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxInboundDataExportResponse> {
    return this.mailboxService.exportInboundEventData({
      userId: ctx.req.user.id,
      mailboxId,
      workspaceId,
      limit,
      windowHours,
      bucketMinutes,
    });
  }

  @Mutation(() => MailboxInboundRetentionPurgeResponse)
  async purgeMyMailboxInboundRetentionData(
    @Context() ctx: RequestContext,
    @Args('retentionDays', { type: () => Int, nullable: true })
    retentionDays?: number,
  ): Promise<MailboxInboundRetentionPurgeResponse> {
    return this.mailboxService.purgeInboundEventRetentionData({
      userId: ctx.req.user.id,
      retentionDays: retentionDays ?? null,
    });
  }

  @Query(() => [MailboxSyncStateResponse])
  async myMailboxSyncStates(
    @Context() ctx: RequestContext,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
  ): Promise<MailboxSyncStateResponse[]> {
    return this.mailboxSyncService.listMailboxSyncStatesForUser({
      userId: ctx.req.user.id,
      workspaceId: workspaceId || null,
    });
  }

  @Mutation(() => MailboxSyncRunResponse)
  async syncMyMailboxPull(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
  ): Promise<MailboxSyncRunResponse> {
    const summary = await this.mailboxSyncService.pollUserMailboxes({
      userId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
    });
    return {
      ...summary,
      executedAtIso: new Date().toISOString(),
    };
  }
}
