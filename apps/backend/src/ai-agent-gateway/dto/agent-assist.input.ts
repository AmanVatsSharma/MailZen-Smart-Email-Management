/**
 * File: apps/backend/src/ai-agent-gateway/dto/agent-assist.input.ts
 * Module: ai-agent-gateway
 * Purpose: GraphQL input contracts for agent assist mutation.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - Validates chat payload boundaries before gateway execution.
 * - Read AgentAssistInput first.
 */
import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class AgentMessageInput {
  @Field()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  content: string;
}

@InputType()
export class AgentContextInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  surface?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  metadataJson?: string;
}

@InputType()
export class AgentAssistInput {
  @Field({ defaultValue: 'auth' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  skill: string = 'auth';

  @Field(() => [AgentMessageInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AgentMessageInput)
  messages: AgentMessageInput[];

  @Field(() => AgentContextInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgentContextInput)
  context?: AgentContextInput;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  allowedActions?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestedAction?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  requestedActionApprovalToken?: string;

  @Field({ defaultValue: false })
  @IsBoolean()
  executeRequestedAction: boolean = false;
}
