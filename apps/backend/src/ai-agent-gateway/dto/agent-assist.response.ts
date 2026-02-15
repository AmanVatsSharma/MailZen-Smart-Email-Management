/**
 * File: apps/backend/src/ai-agent-gateway/dto/agent-assist.response.ts
 * Module: ai-agent-gateway
 * Purpose: GraphQL response contracts for agent assist mutation.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - Keeps payload frontend-friendly and transport-safe.
 * - Read AgentAssistResponse first.
 */
import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentSuggestedActionResponse {
  @Field()
  name: string;

  @Field()
  label: string;

  @Field({ nullable: true })
  payloadJson?: string;

  @Field()
  requiresApproval: boolean;

  @Field({ nullable: true })
  approvalToken?: string;

  @Field({ nullable: true })
  approvalTokenExpiresAtIso?: string;
}

@ObjectType()
export class AgentSafetyFlagResponse {
  @Field()
  code: string;

  @Field()
  severity: string;

  @Field()
  message: string;
}

@ObjectType()
export class AgentActionExecutionResponse {
  @Field()
  action: string;

  @Field()
  executed: boolean;

  @Field()
  message: string;
}

@ObjectType()
export class AgentAssistResponse {
  @Field()
  version: string;

  @Field()
  skill: string;

  @Field()
  requestId: string;

  @Field()
  assistantText: string;

  @Field()
  intent: string;

  @Field(() => Float)
  confidence: number;

  @Field(() => [AgentSuggestedActionResponse])
  suggestedActions: AgentSuggestedActionResponse[];

  @Field(() => [AgentSafetyFlagResponse])
  safetyFlags: AgentSafetyFlagResponse[];

  @Field({ nullable: true })
  uiHintsJson?: string;

  @Field(() => AgentActionExecutionResponse, { nullable: true })
  executedAction?: AgentActionExecutionResponse;
}
