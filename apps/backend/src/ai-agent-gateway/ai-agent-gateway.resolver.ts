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
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { randomUUID } from 'crypto';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AgentAssistInput } from './dto/agent-assist.input';
import { AgentAssistResponse } from './dto/agent-assist.response';
import { AgentPlatformHealthResponse } from './dto/agent-platform-health.response';

interface RequestContext {
  req?: {
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
}
