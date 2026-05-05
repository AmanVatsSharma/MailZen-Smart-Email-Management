/**
 * File:        apps/backend/src/automation/automation.resolver.ts
 * Module:      Automation Engine · GraphQL Resolver
 * Purpose:     GraphQL queries + mutations for the Automation Engine.
 *              Queries are workspace-scoped (always pass workspaceId). Mutations use
 *              WorkspaceAdminGuard for write operations (enable/disable/archive).
 *
 * Exports:
 *   - AutomationResolver  — @Resolver() NestJS class
 *
 * Depends on:
 *   - AutomationService  — business logic for all operations
 *   - JwtAuthGuard       — applied at class level, required for all queries/mutations
 *   - WorkspaceAdminGuard— applied to admin-only mutations
 *
 * Side-effects:
 *   - none directly; delegates to AutomationService which writes DB + AuditLog
 *
 * Key invariants:
 *   - All queries enforce workspaceId — no cross-tenant reads
 *   - schema.gql is auto-generated; never edit it manually
 *
 * Read order:
 *   1. Queries (automations, automation, automationRuns, automationRun)
 *   2. Mutations (create, update, enable, disable, archive, manualRun, retry, cancel)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import GraphQLJSON from 'graphql-type-json';
import { validateTrigger, validateCondition, validateSteps } from '@mailzen/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceAdminGuard } from './guards/workspace-admin.guard';
import { AutomationService } from './automation.service';
import { Automation, AutomationStatus } from './entities/automation.entity';
import { AutomationVersion } from './entities/automation-version.entity';
import { AutomationRun, AutomationRunStatus } from './entities/automation-run.entity';
import { AutomationStepRun } from './entities/automation-step-run.entity';
import { AutomationConnection, AutomationRunConnection } from './dto/automation.connection';
import { WorkspaceIntegration } from './entities/workspace-integration.entity';
import { WebhookIntegrationService } from './integrations/webhook-integration.service';
import { WebhookInstallResult } from './dto/webhook-install.result';

interface GqlContext {
  req: { user: { id: string } };
}

@Resolver(() => Automation)
@UseGuards(JwtAuthGuard)
export class AutomationResolver {
  constructor(private readonly automationService: AutomationService) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  @Query(() => AutomationConnection)
  async automations(
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('status', { type: () => AutomationStatus, nullable: true }) status?: AutomationStatus,
    @Args('ownerUserId', { type: () => ID, nullable: true }) ownerUserId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('cursor', { nullable: true }) cursor?: string,
  ): Promise<AutomationConnection> {
    return this.automationService.listAutomations({ workspaceId, status, ownerUserId, limit, cursor });
  }

  @Query(() => Automation, { nullable: true })
  async automation(
    @Args('id', { type: () => ID }) id: string,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
  ): Promise<Automation | null> {
    return this.automationService.getAutomation(id, workspaceId).catch(() => null);
  }

  @Query(() => AutomationRunConnection)
  async automationRuns(
    @Args('workspaceId', { type: () => ID, nullable: true }) workspaceId?: string,
    @Args('automationId', { type: () => ID, nullable: true }) automationId?: string,
    @Args('status', { type: () => AutomationRunStatus, nullable: true }) status?: AutomationRunStatus,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('cursor', { nullable: true }) cursor?: string,
  ): Promise<AutomationRunConnection> {
    return this.automationService.listRuns({ workspaceId, automationId, status, limit, cursor });
  }

  @Query(() => AutomationRun, { nullable: true })
  async automationRun(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AutomationRun | null> {
    return this.automationService.getRun(id).catch(() => null);
  }

  // ─── Field resolvers ──────────────────────────────────────────────────────

  @ResolveField(() => [AutomationVersion])
  async versions(
    @Parent() automation: Automation,
    @Args('limit', { type: () => Int, nullable: true }) limit = 10,
    @Context() ctx: GqlContext,
  ): Promise<AutomationVersion[]> {
    return this.automationService.getAutomationVersions(automation.id, automation.workspaceId, limit);
  }

  @ResolveField(() => [AutomationRun])
  async recentRuns(
    @Parent() automation: Automation,
    @Args('limit', { type: () => Int, nullable: true }) limit = 20,
    @Args('status', { type: () => AutomationRunStatus, nullable: true }) status?: AutomationRunStatus,
  ): Promise<AutomationRun[]> {
    const connection = await this.automationService.listRuns({
      automationId: automation.id,
      status,
      limit,
    });
    return connection.nodes;
  }

  @ResolveField(() => [AutomationStepRun])
  async steps(@Parent() run: AutomationRun): Promise<AutomationStepRun[]> {
    return this.automationService.getRunSteps(run.id);
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  @Mutation(() => Automation)
  async createAutomation(
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('name') name: string,
    @Args('trigger', { type: () => GraphQLJSON }) trigger: Record<string, unknown>,
    @Args('steps', { type: () => GraphQLJSON }) steps: Record<string, unknown>[],
    @Args('description', { nullable: true }) description?: string,
    @Args('ownerUserId', { type: () => ID, nullable: true }) ownerUserId?: string,
    @Args('conditions', { type: () => GraphQLJSON, nullable: true }) conditions?: Record<string, unknown>,
    @Context() ctx?: GqlContext,
  ): Promise<Automation> {
    const userId = ctx!.req.user.id;
    const triggerErr = validateTrigger(trigger);
    if (triggerErr) throw new BadRequestException(`Invalid trigger: ${triggerErr}`);
    const stepsErr = validateSteps(steps);
    if (stepsErr) throw new BadRequestException(`Invalid steps: ${stepsErr}`);
    if (conditions) {
      const condErr = validateCondition(conditions);
      if (condErr) throw new BadRequestException(`Invalid conditions: ${condErr}`);
    }
    return this.automationService.createAutomation({
      workspaceId,
      ownerUserId,
      name,
      description,
      trigger,
      conditions,
      steps,
      createdByUserId: userId,
    });
  }

  @Mutation(() => Automation)
  async updateAutomation(
    @Args('id', { type: () => ID }) id: string,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('trigger', { type: () => GraphQLJSON, nullable: true }) trigger?: Record<string, unknown>,
    @Args('conditions', { type: () => GraphQLJSON, nullable: true }) conditions?: Record<string, unknown>,
    @Args('steps', { type: () => GraphQLJSON, nullable: true }) steps?: Record<string, unknown>[],
    @Context() ctx?: GqlContext,
  ): Promise<Automation> {
    const userId = ctx!.req.user.id;
    if (trigger) {
      const triggerErr = validateTrigger(trigger);
      if (triggerErr) throw new BadRequestException(`Invalid trigger: ${triggerErr}`);
    }
    if (steps) {
      const stepsErr = validateSteps(steps);
      if (stepsErr) throw new BadRequestException(`Invalid steps: ${stepsErr}`);
    }
    if (conditions) {
      const condErr = validateCondition(conditions);
      if (condErr) throw new BadRequestException(`Invalid conditions: ${condErr}`);
    }
    return this.automationService.updateAutomation({ id, workspaceId, userId, name, description, trigger, conditions, steps });
  }

  @Mutation(() => Automation)
  @UseGuards(WorkspaceAdminGuard)
  async enableAutomation(
    @Args('id', { type: () => ID }) id: string,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Context() ctx: GqlContext,
  ): Promise<Automation> {
    return this.automationService.enableAutomation(id, workspaceId, ctx.req.user.id);
  }

  @Mutation(() => Automation)
  @UseGuards(WorkspaceAdminGuard)
  async disableAutomation(
    @Args('id', { type: () => ID }) id: string,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Context() ctx: GqlContext,
  ): Promise<Automation> {
    return this.automationService.disableAutomation(id, workspaceId, ctx.req.user.id);
  }

  @Mutation(() => Automation)
  @UseGuards(WorkspaceAdminGuard)
  async archiveAutomation(
    @Args('id', { type: () => ID }) id: string,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Context() ctx: GqlContext,
  ): Promise<Automation> {
    return this.automationService.archiveAutomation(id, workspaceId, ctx.req.user.id);
  }

  @Mutation(() => AutomationRun)
  async runAutomationManually(
    @Args('id', { type: () => ID }) id: string,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('contextOverride', { type: () => GraphQLJSON, nullable: true }) contextOverride?: Record<string, unknown>,
    @Context() ctx?: GqlContext,
  ): Promise<AutomationRun> {
    return this.automationService.runAutomationManually(id, workspaceId, ctx!.req.user.id, contextOverride);
  }

  @Mutation(() => AutomationRun)
  async retryAutomationRun(
    @Args('runId', { type: () => ID }) runId: string,
    @Context() ctx: GqlContext,
  ): Promise<AutomationRun> {
    return this.automationService.retryAutomationRun(runId, ctx.req.user.id);
  }

  @Mutation(() => AutomationRun)
  async cancelAutomationRun(
    @Args('runId', { type: () => ID }) runId: string,
    @Context() ctx: GqlContext,
  ): Promise<AutomationRun> {
    return this.automationService.cancelAutomationRun(runId, ctx.req.user.id);
  }
}

// AutomationRun field resolver for steps (separate resolver class for the run type)
@Resolver(() => AutomationRun)
@UseGuards(JwtAuthGuard)
export class AutomationRunResolver {
  constructor(private readonly automationService: AutomationService) {}

  @ResolveField(() => [AutomationStepRun])
  async steps(@Parent() run: AutomationRun): Promise<AutomationStepRun[]> {
    return this.automationService.getRunSteps(run.id);
  }
}

// Workspace integration management mutations (webhook install/revoke)
@Resolver(() => WorkspaceIntegration)
@UseGuards(JwtAuthGuard)
export class IntegrationResolver {
  constructor(private readonly webhookIntegrationService: WebhookIntegrationService) {}

  @Mutation(() => WebhookInstallResult)
  async installWebhookIntegration(
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('url') url: string,
    @Args('displayName') displayName: string,
    @Context() ctx: GqlContext,
  ): Promise<WebhookInstallResult> {
    const { integration, plaintextSecret } = await this.webhookIntegrationService.installWebhook(
      workspaceId,
      url,
      displayName,
      ctx.req.user.id,
    );
    return { integration, plaintextSecret };
  }

  @Mutation(() => WorkspaceIntegration)
  async revokeWebhookIntegration(
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
  ): Promise<WorkspaceIntegration> {
    return this.webhookIntegrationService.revokeWebhook(workspaceId);
  }

  @Query(() => WorkspaceIntegration, { nullable: true })
  async webhookIntegration(
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
  ): Promise<WorkspaceIntegration | null> {
    return this.webhookIntegrationService.getWebhookIntegration(workspaceId);
  }
}
