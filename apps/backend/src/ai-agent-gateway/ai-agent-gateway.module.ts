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
import { BillingModule } from '../billing/billing.module';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { NotificationModule } from '../notification/notification.module';
import { User } from '../user/entities/user.entity';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { AiAgentActionAuditRetentionScheduler } from './ai-agent-action-audit-retention.scheduler';
import { AiAgentGatewayResolver } from './ai-agent-gateway.resolver';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AgentActionAudit } from './entities/agent-action-audit.entity';
import { AgentPlatformEndpointRuntimeStat } from './entities/agent-platform-endpoint-runtime-stat.entity';
import { AgentPlatformHealthSample } from './entities/agent-platform-health-sample.entity';
import { AgentPlatformSkillRuntimeStat } from './entities/agent-platform-skill-runtime-stat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ExternalEmailMessage,
      WorkspaceMember,
      AgentActionAudit,
      AgentPlatformEndpointRuntimeStat,
      AgentPlatformHealthSample,
      AgentPlatformSkillRuntimeStat,
    ]),
    BillingModule,
    NotificationModule,
  ],
  providers: [
    AiAgentGatewayResolver,
    AiAgentGatewayService,
    AiAgentActionAuditRetentionScheduler,
  ],
  exports: [AiAgentGatewayService],
})
export class AiAgentGatewayModule {}
