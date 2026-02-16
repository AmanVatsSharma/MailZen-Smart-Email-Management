/**
 * File: apps/backend/src/ai-agent-gateway/ai-agent-gateway.resolver.ts
 * Module: ai-agent-gateway
 * Purpose: GraphQL resolver for platform-level assistant requests.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - Exposes a mutation for skill-scoped assistant interactions.
 * - Read agentAssist() first.
 */
import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { randomUUID } from 'crypto';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AiAgentPlatformHealthAlertScheduler } from './ai-agent-platform-health-alert.scheduler';
import { AgentActionAuditRetentionPurgeResponse } from './dto/agent-action-audit-retention-purge.response';
import { AgentAssistInput } from './dto/agent-assist.input';
import { AgentAssistResponse } from './dto/agent-assist.response';
import { AgentActionDataExportResponse } from './dto/agent-action-data-export.response';
import { AgentPlatformHealthAlertCheckResponse } from './dto/agent-platform-health-alert-check.response';
import { AgentPlatformHealthAlertConfigResponse } from './dto/agent-platform-health-alert-config.response';
import { AgentPlatformHealthAlertDeliveryDataExportResponse } from './dto/agent-platform-health-alert-delivery-data-export.response';
import { AgentPlatformHealthAlertRunHistoryDataExportResponse } from './dto/agent-platform-health-alert-run-history-data-export.response';
import { AgentPlatformHealthAlertRunRetentionPurgeResponse } from './dto/agent-platform-health-alert-run-retention-purge.response';
import {
  AgentPlatformHealthAlertDeliveryStatsResponse,
  AgentPlatformHealthAlertDeliveryTrendPointResponse,
} from './dto/agent-platform-health-alert-delivery-stats.response';
import { AgentPlatformHealthAlertRunResponse } from './dto/agent-platform-health-alert-run.response';
import {
  AgentPlatformHealthAlertRunTrendPointResponse,
  AgentPlatformHealthAlertRunTrendSummaryResponse,
} from './dto/agent-platform-health-alert-run-trend.response';
import { AgentPlatformHealthResponse } from './dto/agent-platform-health.response';
import { AgentPlatformHealthIncidentDataExportResponse } from './dto/agent-platform-health-incident-data-export.response';
import { AgentPlatformHealthSampleDataExportResponse } from './dto/agent-platform-health-sample-data-export.response';
import { AgentPlatformHealthSampleResponse } from './dto/agent-platform-health-sample.response';
import { AgentPlatformHealthSampleRetentionPurgeResponse } from './dto/agent-platform-health-sample-retention-purge.response';
import {
  AgentPlatformHealthIncidentStatsResponse,
  AgentPlatformHealthIncidentTrendPointResponse,
} from './dto/agent-platform-health-incident-stats.response';
import { AgentPlatformHealthTrendPointResponse } from './dto/agent-platform-health-trend-point.response';
import { AgentPlatformHealthTrendSummaryResponse } from './dto/agent-platform-health-trend-summary.response';
import { AgentPlatformRuntimeResetResponse } from './dto/agent-platform-runtime-reset.response';
import { AgentPlatformSkillRuntimeResetResponse } from './dto/agent-platform-skill-runtime-reset.response';
import { AgentActionAudit } from './entities/agent-action-audit.entity';

interface RequestContext {
  req?: {
    user?: {
      id?: string;
    };
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
  };
}

@Resolver()
export class AiAgentGatewayResolver {
  constructor(
    private readonly gatewayService: AiAgentGatewayService,
    private readonly healthAlertScheduler: AiAgentPlatformHealthAlertScheduler,
  ) {}

  @Mutation(() => AgentAssistResponse)
  async agentAssist(
    @Args('input') input: AgentAssistInput,
    @Context() ctx: RequestContext,
  ): Promise<AgentAssistResponse> {
    const headerRequestId = ctx.req?.headers?.['x-request-id'];
    const requestId = Array.isArray(headerRequestId)
      ? headerRequestId[0]
      : headerRequestId || randomUUID();

    return this.gatewayService.assist(input, {
      requestId,
      ip: ctx.req?.ip,
      headers: ctx.req?.headers,
    });
  }

  @Query(() => AgentPlatformHealthResponse)
  async agentPlatformHealth(): Promise<AgentPlatformHealthResponse> {
    return this.gatewayService.getPlatformHealth();
  }

  @Query(() => [AgentPlatformHealthSampleResponse], {
    description:
      'List persisted AI platform health snapshots for observability analysis',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthHistory(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<AgentPlatformHealthSampleResponse[]> {
    return this.gatewayService.getPlatformHealthHistory({
      limit,
      windowHours,
    });
  }

  @Query(() => AgentPlatformHealthSampleDataExportResponse, {
    description:
      'Export persisted AI platform health snapshots as JSON for observability pipelines',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthSampleDataExport(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<AgentPlatformHealthSampleDataExportResponse> {
    return this.gatewayService.exportPlatformHealthSampleData({
      limit,
      windowHours,
    });
  }

  @Query(() => AgentPlatformHealthTrendSummaryResponse, {
    description:
      'Get aggregated AI platform health trend summary for a rolling time window',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthTrendSummary(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<AgentPlatformHealthTrendSummaryResponse> {
    return this.gatewayService.getPlatformHealthTrendSummary({
      windowHours,
    });
  }

  @Query(() => [AgentPlatformHealthTrendPointResponse], {
    description:
      'Get bucketed AI platform health trend series for observability dashboards',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthTrendSeries(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<AgentPlatformHealthTrendPointResponse[]> {
    return this.gatewayService.getPlatformHealthTrendSeries({
      windowHours,
      bucketMinutes,
    });
  }

  @Query(() => AgentPlatformHealthIncidentStatsResponse, {
    description:
      'Get aggregated warn/critical AI platform health incident counts for a rolling window',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthIncidentStats(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<AgentPlatformHealthIncidentStatsResponse> {
    return this.gatewayService.getPlatformHealthIncidentStats({
      windowHours,
    });
  }

  @Query(() => [AgentPlatformHealthIncidentTrendPointResponse], {
    description:
      'Get warn/critical AI platform health incident trend buckets over a rolling window',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthIncidentSeries(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<AgentPlatformHealthIncidentTrendPointResponse[]> {
    return this.gatewayService.getPlatformHealthIncidentSeries({
      windowHours,
      bucketMinutes,
    });
  }

  @Query(() => AgentPlatformHealthIncidentDataExportResponse, {
    description:
      'Export warn/critical AI platform health incident analytics as JSON payload',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthIncidentDataExport(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<AgentPlatformHealthIncidentDataExportResponse> {
    return this.gatewayService.exportPlatformHealthIncidentData({
      windowHours,
      bucketMinutes,
    });
  }

  @Query(() => AgentPlatformHealthAlertDeliveryStatsResponse, {
    description:
      'Get delivery stats for emitted AI platform health alert notifications',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthAlertDeliveryStats(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<AgentPlatformHealthAlertDeliveryStatsResponse> {
    return this.healthAlertScheduler.getAlertDeliveryStats({
      windowHours,
    });
  }

  @Query(() => [AgentPlatformHealthAlertDeliveryTrendPointResponse], {
    description:
      'Get bucketed delivery trend points for emitted AI platform health alert notifications',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthAlertDeliverySeries(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<AgentPlatformHealthAlertDeliveryTrendPointResponse[]> {
    return this.healthAlertScheduler.getAlertDeliverySeries({
      windowHours,
      bucketMinutes,
    });
  }

  @Query(() => AgentPlatformHealthAlertDeliveryDataExportResponse, {
    description:
      'Export AI platform health alert delivery analytics as JSON payload',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthAlertDeliveryDataExport(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<AgentPlatformHealthAlertDeliveryDataExportResponse> {
    return this.healthAlertScheduler.exportAlertDeliveryData({
      windowHours,
      bucketMinutes,
    });
  }

  @Query(() => AgentPlatformHealthAlertConfigResponse, {
    description:
      'Get resolved AI platform health alert scheduler configuration snapshot',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  agentPlatformHealthAlertConfig(): AgentPlatformHealthAlertConfigResponse {
    return this.healthAlertScheduler.getAlertConfigSnapshot();
  }

  @Query(() => [AgentPlatformHealthAlertRunResponse], {
    description:
      'List persisted AI platform health alert scheduler run snapshots for audit and troubleshooting',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthAlertRunHistory(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<AgentPlatformHealthAlertRunResponse[]> {
    return this.healthAlertScheduler.getAlertRunHistory({
      limit,
      windowHours,
    });
  }

  @Query(() => AgentPlatformHealthAlertRunHistoryDataExportResponse, {
    description:
      'Export persisted AI platform health alert run history as JSON payload',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthAlertRunHistoryDataExport(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<AgentPlatformHealthAlertRunHistoryDataExportResponse> {
    return this.healthAlertScheduler.exportAlertRunHistoryData({
      limit,
      windowHours,
    });
  }

  @Query(() => AgentPlatformHealthAlertRunTrendSummaryResponse, {
    description:
      'Get aggregated trend summary over persisted AI platform health alert runs',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthAlertRunTrendSummary(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
  ): Promise<AgentPlatformHealthAlertRunTrendSummaryResponse> {
    return this.healthAlertScheduler.getAlertRunTrendSummary({
      windowHours,
    });
  }

  @Query(() => [AgentPlatformHealthAlertRunTrendPointResponse], {
    description:
      'Get bucketed trend points over persisted AI platform health alert runs',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async agentPlatformHealthAlertRunTrendSeries(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes?: number,
  ): Promise<AgentPlatformHealthAlertRunTrendPointResponse[]> {
    return this.healthAlertScheduler.getAlertRunTrendSeries({
      windowHours,
      bucketMinutes,
    });
  }

  @Query(() => [AgentActionAudit], {
    description: 'List current user agent action audit events',
  })
  @UseGuards(JwtAuthGuard)
  async myAgentActionAudits(
    @Context() ctx: RequestContext,
    @Args('limit', { nullable: true }) limit?: number,
  ): Promise<AgentActionAudit[]> {
    const userId = String(ctx.req?.user?.id || '').trim();
    return this.gatewayService.listAgentActionAuditsForUser({
      userId,
      limit: typeof limit === 'number' ? limit : undefined,
    });
  }

  @Query(() => AgentActionDataExportResponse, {
    description: 'Export current user agent action audits',
  })
  @UseGuards(JwtAuthGuard)
  async myAgentActionDataExport(
    @Context() ctx: RequestContext,
    @Args('limit', { type: () => Int, defaultValue: 200 }) limit: number,
  ): Promise<AgentActionDataExportResponse> {
    const userId = String(ctx.req?.user?.id || '').trim();
    return this.gatewayService.exportAgentActionDataForUser({
      userId,
      limit,
    });
  }

  @Mutation(() => AgentActionAuditRetentionPurgeResponse, {
    description: 'Purge expired agent action audits by retention policy',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async purgeAgentActionRetentionData(
    @Args('retentionDays', { nullable: true }) retentionDays?: number,
    @Args('userId', { nullable: true }) userId?: string,
  ): Promise<AgentActionAuditRetentionPurgeResponse> {
    return this.gatewayService.purgeAgentActionAuditRetentionData({
      retentionDays,
      userId,
    });
  }

  @Mutation(() => AgentPlatformRuntimeResetResponse, {
    description:
      'Reset AI platform endpoint runtime statistics (all or one endpoint)',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resetAgentPlatformRuntimeStats(
    @Args('endpointUrl', { nullable: true }) endpointUrl?: string,
  ): Promise<AgentPlatformRuntimeResetResponse> {
    return this.gatewayService.resetPlatformRuntimeStats({
      endpointUrl,
    });
  }

  @Mutation(() => AgentPlatformSkillRuntimeResetResponse, {
    description:
      'Reset AI platform skill runtime statistics (all or one skill)',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resetAgentPlatformSkillRuntimeStats(
    @Args('skill', { nullable: true }) skill?: string,
  ): Promise<AgentPlatformSkillRuntimeResetResponse> {
    return this.gatewayService.resetSkillRuntimeStats({
      skill,
    });
  }

  @Mutation(() => AgentPlatformHealthSampleRetentionPurgeResponse, {
    description:
      'Purge persisted AI platform health samples by retention policy',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async purgeAgentPlatformHealthSampleRetentionData(
    @Args('retentionDays', { nullable: true }) retentionDays?: number,
  ): Promise<AgentPlatformHealthSampleRetentionPurgeResponse> {
    return this.gatewayService.purgePlatformHealthSampleRetentionData({
      retentionDays,
    });
  }

  @Mutation(() => AgentPlatformHealthAlertCheckResponse, {
    description:
      'Run AI platform health anomaly alert evaluation immediately (admin only)',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async runAgentPlatformHealthAlertCheck(
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours?: number,
    @Args('baselineWindowHours', { type: () => Int, nullable: true })
    baselineWindowHours?: number,
    @Args('cooldownMinutes', { type: () => Int, nullable: true })
    cooldownMinutes?: number,
    @Args('minSampleCount', { type: () => Int, nullable: true })
    minSampleCount?: number,
  ): Promise<AgentPlatformHealthAlertCheckResponse> {
    return this.healthAlertScheduler.runHealthAlertCheck({
      windowHours,
      baselineWindowHours,
      cooldownMinutes,
      minSampleCount,
    });
  }

  @Mutation(() => AgentPlatformHealthAlertRunRetentionPurgeResponse, {
    description:
      'Purge persisted AI platform health alert run snapshots by retention policy',
  })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async purgeAgentPlatformHealthAlertRunRetentionData(
    @Args('retentionDays', { type: () => Int, nullable: true })
    retentionDays?: number,
  ): Promise<AgentPlatformHealthAlertRunRetentionPurgeResponse> {
    return this.healthAlertScheduler.purgeAlertRunRetentionData({
      retentionDays,
    });
  }
}
