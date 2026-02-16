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
import { AgentActionAuditRetentionPurgeResponse } from './dto/agent-action-audit-retention-purge.response';
import { AgentAssistInput } from './dto/agent-assist.input';
import { AgentAssistResponse } from './dto/agent-assist.response';
import { AgentActionDataExportResponse } from './dto/agent-action-data-export.response';
import { AgentPlatformHealthResponse } from './dto/agent-platform-health.response';
import { AgentPlatformHealthSampleDataExportResponse } from './dto/agent-platform-health-sample-data-export.response';
import { AgentPlatformHealthSampleResponse } from './dto/agent-platform-health-sample.response';
import { AgentPlatformHealthSampleRetentionPurgeResponse } from './dto/agent-platform-health-sample-retention-purge.response';
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
  constructor(private readonly gatewayService: AiAgentGatewayService) {}

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
}
