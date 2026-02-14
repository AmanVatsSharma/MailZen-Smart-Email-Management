/**
 * File: apps/backend/src/ai-agent-gateway/dto/agent-platform-health.response.ts
 * Module: ai-agent-gateway
 * Purpose: GraphQL health and observability response for agent platform checks.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-15
 * Notes:
 * - Includes both remote platform status and gateway metrics snapshot.
 * - Read AgentPlatformHealthResponse first.
 */
import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthResponse {
  @Field()
  status: string;

  @Field()
  reachable: boolean;

  @Field()
  serviceUrl: string;

  @Field(() => Float)
  latencyMs: number;

  @Field()
  checkedAtIso: string;

  @Field(() => Int)
  requestCount: number;

  @Field(() => Int)
  errorCount: number;

  @Field(() => Int)
  timeoutErrorCount: number;

  @Field(() => Float)
  errorRatePercent: number;

  @Field(() => Float)
  avgLatencyMs: number;

  @Field(() => Float)
  latencyWarnMs: number;

  @Field(() => Float)
  errorRateWarnPercent: number;

  @Field()
  alertingState: string;
}
