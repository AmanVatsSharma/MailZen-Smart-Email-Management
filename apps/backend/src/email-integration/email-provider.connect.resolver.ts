import {
  Args,
  Context,
  Float,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailProviderService } from './email-provider.service';
import { ProviderSyncIncidentScheduler } from './provider-sync-incident.scheduler';
import { Provider } from './entities/provider.entity';
import { ProviderActionResult } from './entities/provider-action-result.entity';
import { SmtpSettingsInput } from './dto/smtp-settings.input';
import { ProviderSyncAlertDeliveryDataExportResponse } from './entities/provider-sync-alert-delivery-data-export.response';
import { ProviderSyncIncidentAlertCheckResponse } from './entities/provider-sync-incident-alert-check.response';
import { ProviderSyncIncidentAlertConfigResponse } from './entities/provider-sync-incident-alert-config.response';
import { ProviderSyncIncidentAlertDeliveryDataExportResponse } from './entities/provider-sync-incident-alert-delivery-data-export.response';
import { ProviderSyncIncidentAlertHistoryDataExportResponse } from './entities/provider-sync-incident-alert-history-data-export.response';
import {
  ProviderSyncAlertDeliveryStatsResponse,
  ProviderSyncAlertDeliveryTrendPointResponse,
  ProviderSyncAlertResponse,
} from './entities/provider-sync-alert-delivery.response.entity';
import {
  ProviderSyncIncidentAlertDeliveryStatsResponse,
  ProviderSyncIncidentAlertDeliveryTrendPointResponse,
  ProviderSyncIncidentAlertResponse,
} from './entities/provider-sync-incident-alert-delivery.response.entity';
import { ProviderSyncDataExportResponse } from './entities/provider-sync-data-export.response';
import { ProviderSyncRunResponse } from './entities/provider-sync-run-response.entity';
import { ProviderSyncStatsResponse } from './entities/provider-sync-stats-response.entity';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

/**
 * Frontend-facing provider connect + management mutations.
 *
 * This intentionally matches the names used in:
 * - `apps/frontend/lib/providers/provider-utils.ts`
 */
@Resolver(() => Provider)
@UseGuards(JwtAuthGuard)
export class EmailProviderConnectResolver {
  constructor(
    private readonly emailProviderService: EmailProviderService,
    private readonly providerSyncIncidentScheduler: ProviderSyncIncidentScheduler,
  ) {}

  @Mutation(() => Provider)
  async connectGmail(
    @Args('code') code: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.connectGmail(code, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async connectOutlook(
    @Args('code') code: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.connectOutlook(code, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async connectSmtp(
    @Args('settings') settings: SmtpSettingsInput,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.connectSmtp(settings, ctx.req.user.id);
  }

  @Mutation(() => ProviderActionResult)
  async disconnectProvider(
    @Args('id') id: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.disconnectProvider(id, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async updateProvider(
    @Args('id') id: string,
    // Explicit type required (nullable boolean unions can break GraphQL reflection).
    @Args('isActive', { type: () => Boolean, nullable: true })
    isActive: boolean,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.setActiveProvider(
      id,
      ctx.req.user.id,
      isActive ?? undefined,
    );
  }

  @Mutation(() => Provider)
  async syncProvider(@Args('id') id: string, @Context() ctx: RequestContext) {
    return this.emailProviderService.syncProvider(id, ctx.req.user.id);
  }

  @Mutation(() => ProviderSyncRunResponse)
  async syncMyProviders(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('providerId', { nullable: true }) providerId: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.syncUserProviders({
      userId: ctx.req.user.id,
      workspaceId,
      providerId,
    });
  }

  @Query(() => [Provider])
  async providers(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.listProvidersUi(
      ctx.req.user.id,
      workspaceId,
    );
  }

  /**
   * Backwards-compatible alias for older frontend queries.
   * Prefer `providers`.
   */
  @Query(() => [Provider])
  async getEmailProviders(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.listProvidersUi(
      ctx.req.user.id,
      workspaceId,
    );
  }

  @Query(() => ProviderSyncStatsResponse)
  async myProviderSyncStats(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.getProviderSyncStatsForUser({
      userId: ctx.req.user.id,
      workspaceId,
      windowHours,
    });
  }

  @Query(() => ProviderSyncDataExportResponse)
  async myProviderSyncDataExport(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('limit', { type: () => Int, defaultValue: 200 }) limit: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.exportProviderSyncDataForUser({
      userId: ctx.req.user.id,
      workspaceId,
      limit,
    });
  }

  @Query(() => ProviderSyncAlertDeliveryStatsResponse)
  async myProviderSyncAlertDeliveryStats(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.getProviderSyncAlertDeliveryStatsForUser({
      userId: ctx.req.user.id,
      workspaceId,
      windowHours,
    });
  }

  @Query(() => [ProviderSyncAlertDeliveryTrendPointResponse])
  async myProviderSyncAlertDeliverySeries(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.getProviderSyncAlertDeliverySeriesForUser({
      userId: ctx.req.user.id,
      workspaceId,
      windowHours,
      bucketMinutes,
    });
  }

  @Query(() => [ProviderSyncAlertResponse])
  async myProviderSyncAlerts(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.getProviderSyncAlertsForUser({
      userId: ctx.req.user.id,
      workspaceId,
      windowHours,
      limit,
    });
  }

  @Query(() => ProviderSyncAlertDeliveryDataExportResponse)
  async myProviderSyncAlertDeliveryDataExport(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes: number,
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.exportProviderSyncAlertDeliveryDataForUser(
      {
        userId: ctx.req.user.id,
        workspaceId,
        windowHours,
        bucketMinutes,
        limit,
      },
    );
  }

  @Query(() => ProviderSyncIncidentAlertDeliveryStatsResponse)
  async myProviderSyncIncidentAlertDeliveryStats(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.getProviderSyncIncidentAlertDeliveryStatsForUser(
      {
        userId: ctx.req.user.id,
        workspaceId,
        windowHours,
      },
    );
  }

  @Query(() => [ProviderSyncIncidentAlertDeliveryTrendPointResponse])
  async myProviderSyncIncidentAlertDeliverySeries(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.getProviderSyncIncidentAlertDeliverySeriesForUser(
      {
        userId: ctx.req.user.id,
        workspaceId,
        windowHours,
        bucketMinutes,
      },
    );
  }

  @Query(() => [ProviderSyncIncidentAlertResponse])
  async myProviderSyncIncidentAlerts(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.getProviderSyncIncidentAlertsForUser({
      userId: ctx.req.user.id,
      workspaceId,
      windowHours,
      limit,
    });
  }

  @Query(() => ProviderSyncIncidentAlertDeliveryDataExportResponse)
  async myProviderSyncIncidentAlertDeliveryDataExport(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes: number,
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.exportProviderSyncIncidentAlertDeliveryDataForUser(
      {
        userId: ctx.req.user.id,
        workspaceId,
        windowHours,
        bucketMinutes,
        limit,
      },
    );
  }

  @Query(() => ProviderSyncIncidentAlertHistoryDataExportResponse)
  async myProviderSyncIncidentAlertHistoryDataExport(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.exportProviderSyncIncidentAlertHistoryDataForUser(
      {
        userId: ctx.req.user.id,
        workspaceId,
        windowHours,
        limit,
      },
    );
  }

  @Query(() => ProviderSyncIncidentAlertConfigResponse)
  myProviderSyncIncidentAlertConfig(): ProviderSyncIncidentAlertConfigResponse {
    return this.providerSyncIncidentScheduler.getIncidentAlertConfigSnapshot();
  }

  @Mutation(() => ProviderSyncIncidentAlertCheckResponse)
  async runMyProviderSyncIncidentAlertCheck(
    @Context() ctx: RequestContext,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('warningErrorProviderPercent', { type: () => Float, nullable: true })
    warningErrorProviderPercent: number,
    @Args('criticalErrorProviderPercent', {
      type: () => Float,
      nullable: true,
    })
    criticalErrorProviderPercent: number,
    @Args('minErrorProviders', { type: () => Int, nullable: true })
    minErrorProviders: number,
  ) {
    return this.providerSyncIncidentScheduler.runIncidentAlertCheck({
      userId: ctx.req.user.id,
      windowHours,
      warningErrorProviderPercent,
      criticalErrorProviderPercent,
      minErrorProviders,
    });
  }

  /**
   * Backwards-compatible alias for older frontend mutations.
   * Prefer `updateProvider`.
   */
  @Mutation(() => Provider)
  async updateProviderStatus(
    @Args('id') id: string,
    @Args('isActive', { type: () => Boolean, nullable: true })
    isActive: boolean,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.setActiveProvider(
      id,
      ctx.req.user.id,
      isActive ?? undefined,
    );
  }
}
