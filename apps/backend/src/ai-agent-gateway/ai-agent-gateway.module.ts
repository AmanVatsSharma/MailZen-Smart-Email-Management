/**
 * File: apps/backend/src/ai-agent-gateway/ai-agent-gateway.module.ts
 * Module: ai-agent-gateway
 * Purpose: Module wiring for backend gateway to Python AI platform.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - Registers resolver and service for GraphQL assistant bridge.
 * - Read module imports first.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { AiAgentGatewayResolver } from './ai-agent-gateway.resolver';
import { AiAgentGatewayService } from './ai-agent-gateway.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AiAgentGatewayResolver, AiAgentGatewayService],
  exports: [AiAgentGatewayService],
})
export class AiAgentGatewayModule {}
