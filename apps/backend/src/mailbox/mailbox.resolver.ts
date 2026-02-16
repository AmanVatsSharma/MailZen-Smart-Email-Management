import {
  Resolver,
  Mutation,
  Args,
  Query,
  Context,
  Float,
  Int,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MailboxService } from './mailbox.service';
import { MailboxInboundSlaScheduler } from './mailbox-inbound-sla.scheduler';
import { MailboxSyncIncidentScheduler } from './mailbox-sync-incident.scheduler';
import { MailboxSyncService } from './mailbox-sync.service';
import { MailboxInboundSlaAlertCheckResponse } from './dto/mailbox-inbound-sla-alert-check.response';
import { MailboxInboundDataExportResponse } from './dto/mailbox-inbound-data-export.response';
import {
  MailboxInboundEventObservabilityResponse,
  MailboxInboundEventStatsResponse,
  MailboxInboundEventTrendPointResponse,
} from './dto/mailbox-inbound-event-observability.response';
import { MailboxInboundRetentionPurgeResponse } from './dto/mailbox-inbound-retention-purge.response';
import { MailboxSyncDataExportResponse } from './dto/mailbox-sync-data-export.response';
import { MailboxSyncIncidentAlertConfigResponse } from './dto/mailbox-sync-incident-alert-config.response';
import { MailboxSyncIncidentAlertCheckResponse } from './dto/mailbox-sync-incident-alert-check.response';
import { MailboxSyncIncidentAlertHistoryDataExportResponse } from './dto/mailbox-sync-incident-alert-history-data-export.response';
import { MailboxSyncIncidentAlertDeliveryDataExportResponse } from './dto/mailbox-sync-incident-alert-delivery-data-export.response';
import {
  MailboxSyncIncidentAlertDeliveryStatsResponse,
  MailboxSyncIncidentAlertDeliveryTrendPointResponse,
} from './dto/mailbox-sync-incident-alert-delivery.response';
import { MailboxSyncIncidentAlertResponse } from './dto/mailbox-sync-incident-alert.response';
import { MailboxSyncIncidentDataExportResponse } from './dto/mailbox-sync-incident-data-export.response';
import {
  MailboxSyncIncidentStatsResponse,
  MailboxSyncIncidentTrendPointResponse,
} from './dto/mailbox-sync-incident.response';
import {
  MailboxSyncRunObservabilityResponse,
  MailboxSyncRunStatsResponse,
  MailboxSyncRunTrendPointResponse,
} from './dto/mailbox-sync-observability.response';
import { MailboxSyncRunRetentionPurgeResponse } from './dto/mailbox-sync-run-retention-purge.response';
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
    private readonly mailboxInboundSlaScheduler: MailboxInboundSlaScheduler,
    private readonly mailboxSyncIncidentScheduler: MailboxSyncIncidentScheduler,
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

  @Query(() => MailboxInboundDataExportResponse)
  @UseGuards(AdminGuard)
  async userMailboxInboundDataExport(
    @Context() ctx: RequestContext,
    @Args('userId') userId: string,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxInboundDataExportResponse> {
    return this.mailboxService.exportInboundEventDataForAdmin({
      targetUserId: userId,
      actorUserId: ctx.req.user.id,
      mailboxId,
      workspaceId,
      limit: limit ?? null,
      windowHours: windowHours ?? null,
      bucketMinutes: bucketMinutes ?? null,
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

  @Query(() => [MailboxSyncRunObservabilityResponse])
  async myMailboxSyncRuns(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<MailboxSyncRunObservabilityResponse[]> {
    return this.mailboxSyncService.getMailboxSyncRunsForUser({
      userId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
      windowHours: windowHours ?? null,
      limit: limit ?? null,
    });
  }

  @Query(() => MailboxSyncRunStatsResponse)
  async myMailboxSyncRunStats(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<MailboxSyncRunStatsResponse> {
    return this.mailboxSyncService.getMailboxSyncRunStatsForUser({
      userId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
      windowHours: windowHours ?? null,
    });
  }

  @Query(() => [MailboxSyncRunTrendPointResponse])
  async myMailboxSyncRunSeries(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxSyncRunTrendPointResponse[]> {
    return this.mailboxSyncService.getMailboxSyncRunSeriesForUser({
      userId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
      windowHours: windowHours ?? null,
      bucketMinutes: bucketMinutes ?? null,
    });
  }

  @Query(() => MailboxSyncDataExportResponse)
  async myMailboxSyncDataExport(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxSyncDataExportResponse> {
    return this.mailboxSyncService.exportMailboxSyncDataForUser({
      userId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
      limit: limit ?? null,
      windowHours: windowHours ?? null,
      bucketMinutes: bucketMinutes ?? null,
    });
  }

  @Query(() => MailboxSyncDataExportResponse)
  @UseGuards(AdminGuard)
  async userMailboxSyncDataExport(
    @Context() ctx: RequestContext,
    @Args('userId') userId: string,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxSyncDataExportResponse> {
    return this.mailboxSyncService.exportMailboxSyncDataForAdmin({
      targetUserId: userId,
      actorUserId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
      limit: limit ?? null,
      windowHours: windowHours ?? null,
      bucketMinutes: bucketMinutes ?? null,
    });
  }

  @Query(() => MailboxSyncIncidentStatsResponse)
  async myMailboxSyncIncidentStats(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<MailboxSyncIncidentStatsResponse> {
    return this.mailboxSyncService.getMailboxSyncIncidentStatsForUser({
      userId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
      windowHours: windowHours ?? null,
    });
  }

  @Query(() => [MailboxSyncIncidentTrendPointResponse])
  async myMailboxSyncIncidentSeries(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxSyncIncidentTrendPointResponse[]> {
    return this.mailboxSyncService.getMailboxSyncIncidentSeriesForUser({
      userId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
      windowHours: windowHours ?? null,
      bucketMinutes: bucketMinutes ?? null,
    });
  }

  @Query(() => MailboxSyncIncidentDataExportResponse)
  async myMailboxSyncIncidentDataExport(
    @Context() ctx: RequestContext,
    @Args('mailboxId', { nullable: true }) mailboxId?: string,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxSyncIncidentDataExportResponse> {
    return this.mailboxSyncService.exportMailboxSyncIncidentDataForUser({
      userId: ctx.req.user.id,
      mailboxId: mailboxId || null,
      workspaceId: workspaceId || null,
      windowHours: windowHours ?? null,
      bucketMinutes: bucketMinutes ?? null,
    });
  }

  @Query(() => MailboxSyncIncidentAlertConfigResponse)
  myMailboxSyncIncidentAlertConfig(): MailboxSyncIncidentAlertConfigResponse {
    return this.mailboxSyncIncidentScheduler.getIncidentAlertConfigSnapshot();
  }

  @Mutation(() => MailboxSyncIncidentAlertCheckResponse)
  async runMyMailboxSyncIncidentAlertCheck(
    @Context() ctx: RequestContext,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('warningRatePercent', { type: () => Float, nullable: true })
    warningRatePercent?: number,
    @Args('criticalRatePercent', { type: () => Float, nullable: true })
    criticalRatePercent?: number,
    @Args('minIncidentRuns', { type: () => Int, nullable: true })
    minIncidentRuns?: number,
  ): Promise<MailboxSyncIncidentAlertCheckResponse> {
    return this.mailboxSyncIncidentScheduler.runIncidentAlertCheck({
      userId: ctx.req.user.id,
      windowHours: windowHours ?? null,
      warningRatePercent: warningRatePercent ?? null,
      criticalRatePercent: criticalRatePercent ?? null,
      minIncidentRuns: minIncidentRuns ?? null,
    });
  }

  @Mutation(() => MailboxInboundSlaAlertCheckResponse)
  async runMyMailboxInboundSlaAlertCheck(
    @Context() ctx: RequestContext,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<MailboxInboundSlaAlertCheckResponse> {
    return this.mailboxInboundSlaScheduler.runMailboxInboundSlaAlertCheck({
      userId: ctx.req.user.id,
      windowHours: windowHours ?? null,
    });
  }

  @Query(() => MailboxSyncIncidentAlertDeliveryStatsResponse)
  async myMailboxSyncIncidentAlertDeliveryStats(
    @Context() ctx: RequestContext,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<MailboxSyncIncidentAlertDeliveryStatsResponse> {
    return this.mailboxSyncService.getMailboxSyncIncidentAlertDeliveryStatsForUser(
      {
        userId: ctx.req.user.id,
        workspaceId: workspaceId || null,
        windowHours: windowHours ?? null,
      },
    );
  }

  @Query(() => [MailboxSyncIncidentAlertResponse])
  async myMailboxSyncIncidentAlerts(
    @Context() ctx: RequestContext,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<MailboxSyncIncidentAlertResponse[]> {
    return this.mailboxSyncService.getMailboxSyncIncidentAlertsForUser({
      userId: ctx.req.user.id,
      workspaceId: workspaceId || null,
      windowHours: windowHours ?? null,
      limit: limit ?? null,
    });
  }

  @Query(() => MailboxSyncIncidentAlertHistoryDataExportResponse)
  async myMailboxSyncIncidentAlertHistoryDataExport(
    @Context() ctx: RequestContext,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<MailboxSyncIncidentAlertHistoryDataExportResponse> {
    return this.mailboxSyncService.exportMailboxSyncIncidentAlertHistoryDataForUser(
      {
        userId: ctx.req.user.id,
        workspaceId: workspaceId || null,
        windowHours: windowHours ?? null,
        limit: limit ?? null,
      },
    );
  }

  @Query(() => [MailboxSyncIncidentAlertDeliveryTrendPointResponse])
  async myMailboxSyncIncidentAlertDeliverySeries(
    @Context() ctx: RequestContext,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxSyncIncidentAlertDeliveryTrendPointResponse[]> {
    return this.mailboxSyncService.getMailboxSyncIncidentAlertDeliverySeriesForUser(
      {
        userId: ctx.req.user.id,
        workspaceId: workspaceId || null,
        windowHours: windowHours ?? null,
        bucketMinutes: bucketMinutes ?? null,
      },
    );
  }

  @Query(() => MailboxSyncIncidentAlertDeliveryDataExportResponse)
  async myMailboxSyncIncidentAlertDeliveryDataExport(
    @Context() ctx: RequestContext,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<MailboxSyncIncidentAlertDeliveryDataExportResponse> {
    return this.mailboxSyncService.exportMailboxSyncIncidentAlertDeliveryDataForUser(
      {
        userId: ctx.req.user.id,
        workspaceId: workspaceId || null,
        windowHours: windowHours ?? null,
        bucketMinutes: bucketMinutes ?? null,
      },
    );
  }

  @Mutation(() => MailboxSyncRunRetentionPurgeResponse)
  async purgeMyMailboxSyncRunRetentionData(
    @Context() ctx: RequestContext,
    @Args('retentionDays', { type: () => Int, nullable: true })
    retentionDays?: number,
  ): Promise<MailboxSyncRunRetentionPurgeResponse> {
    return this.mailboxSyncService.purgeMailboxSyncRunRetentionData({
      userId: ctx.req.user.id,
      retentionDays: retentionDays ?? null,
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
