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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AgentAssistInput } from './dto/agent-assist.input';
import { AgentAssistResponse } from './dto/agent-assist.response';
import { AgentActionDataExportResponse } from './dto/agent-action-data-export.response';
import { AgentPlatformHealthResponse } from './dto/agent-platform-health.response';
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
}
