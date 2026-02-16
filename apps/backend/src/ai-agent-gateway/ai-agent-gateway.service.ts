/**
 * File: apps/backend/src/ai-agent-gateway/ai-agent-gateway.service.ts
 * Module: ai-agent-gateway
 * Purpose: Policy-enforced bridge between GraphQL clients and Python agent platform.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - Sanitizes and redacts user content before external model orchestration.
 * - Read assist() then executeRequestedActionIfAllowed().
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { createClient, RedisClientType } from 'redis';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { BillingService } from '../billing/billing.service';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { User } from '../user/entities/user.entity';
import { AgentAssistInput, AgentMessageInput } from './dto/agent-assist.input';
import { AgentPlatformHealthResponse } from './dto/agent-platform-health.response';
import { AgentActionAudit } from './entities/agent-action-audit.entity';
import {
  AgentActionExecutionResponse,
  AgentAssistResponse,
  AgentSafetyFlagResponse,
  AgentSuggestedActionResponse,
} from './dto/agent-assist.response';

interface AgentPlatformPayload {
  version: 'v1';
  skill: string;
  requestId: string;
  messages: Array<{ role: string; content: string }>;
  context: {
    surface: string;
    locale: string;
    email: string | null;
    metadata: Record<string, string>;
  };
  allowedActions: string[];
  requestedAction: string | null;
  requestedActionPayload: Record<string, string>;
}

interface AgentPlatformResponse {
  version: string;
  skill: string;
  assistantText: string;
  intent: string;
  confidence: number;
  suggestedActions: Array<{
    name: string;
    label: string;
    payload: Record<string, string>;
  }>;
  uiHints: Record<string, string>;
  safetyFlags: Array<{ code: string; severity: string; message: string }>;
}

interface GatewayRequestMeta {
  requestId?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

type SkillAccess = 'public' | 'authenticated';

interface SkillPolicy {
  access: SkillAccess;
  allowedActions: Set<string>;
  serverExecutableActions: Set<string>;
  humanApprovalActions: Set<string>;
}

interface GatewaySuggestedAction {
  name: string;
  label: string;
  payload: Record<string, string>;
  requiresApproval?: boolean;
  approvalToken?: string;
  approvalTokenExpiresAtIso?: string;
}

interface PendingActionApproval {
  token: string;
  action: string;
  skill: string;
  userId: string;
  requestId: string;
  expiresAtMs: number;
}

interface GatewayMetrics {
  totalRequests: number;
  failedRequests: number;
  timeoutFailures: number;
  totalLatencyMs: number;
  lastLatencyMs: number;
  lastErrorAtIso?: string;
}

@Injectable()
export class AiAgentGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiAgentGatewayService.name);
  private static readonly MIN_AUDIT_EXPORT_LIMIT = 1;
  private static readonly MAX_AUDIT_EXPORT_LIMIT = 500;
  private static readonly DEFAULT_AUDIT_RETENTION_DAYS = 365;
  private static readonly MIN_AUDIT_RETENTION_DAYS = 7;
  private static readonly MAX_AUDIT_RETENTION_DAYS = 3650;
  private readonly rateLimitWindowMs = 60_000;
  private readonly fallbackRateLimitCounters = new Map<
    string,
    { count: number; windowStartMs: number }
  >();
  private readonly fallbackPendingApprovals = new Map<
    string,
    PendingActionApproval
  >();
  private redisClient: RedisClientType | null = null;
  private redisConnected = false;
  private readonly metrics: GatewayMetrics = {
    totalRequests: 0,
    failedRequests: 0,
    timeoutFailures: 0,
    totalLatencyMs: 0,
    lastLatencyMs: 0,
  };
  private readonly skillPolicies: Record<string, SkillPolicy> = {
    auth: {
      access: 'public',
      allowedActions: new Set([
        'auth.forgot_password',
        'auth.open_register',
        'auth.open_login',
        'auth.send_signup_otp',
      ]),
      serverExecutableActions: new Set(['auth.forgot_password']),
      humanApprovalActions: new Set(),
    },
    'auth-login': {
      access: 'public',
      allowedActions: new Set([
        'auth.forgot_password',
        'auth.open_register',
        'auth.open_login',
        'auth.send_signup_otp',
      ]),
      serverExecutableActions: new Set(['auth.forgot_password']),
      humanApprovalActions: new Set(),
    },
    inbox: {
      access: 'authenticated',
      allowedActions: new Set([
        'inbox.summarize_thread',
        'inbox.compose_reply_draft',
        'inbox.schedule_followup',
        'inbox.open_thread',
      ]),
      serverExecutableActions: new Set([
        'inbox.summarize_thread',
        'inbox.compose_reply_draft',
        'inbox.schedule_followup',
      ]),
      humanApprovalActions: new Set([
        'inbox.compose_reply_draft',
        'inbox.schedule_followup',
      ]),
    },
  };

  constructor(
    private readonly authService: AuthService,
    private readonly billingService: BillingService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ExternalEmailMessage)
    private readonly externalEmailMessageRepo: Repository<ExternalEmailMessage>,
    @InjectRepository(AgentActionAudit)
    private readonly agentActionAuditRepo: Repository<AgentActionAudit>,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.shouldUseRedisRateLimit()) return;

    this.redisClient = createClient({ url: this.getRedisUrl() });
    this.redisClient.on('error', (error) => {
      this.logger.warn(
        `[agent-rate-limit] redis error; falling back to memory: ${String(error)}`,
      );
    });

    try {
      await this.redisClient.connect();
      this.redisConnected = true;
      this.logger.log('[agent-rate-limit] connected to redis store');
    } catch (error) {
      this.redisConnected = false;
      this.logger.warn(
        `[agent-rate-limit] redis connect failed; using memory fallback: ${String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.fallbackPendingApprovals.clear();
    if (!this.redisClient || !this.redisConnected) return;
    await this.redisClient.quit();
  }

  async assist(
    input: AgentAssistInput,
    requestMeta?: GatewayRequestMeta,
  ): Promise<AgentAssistResponse> {
    const startedAtMs = Date.now();
    let failed = false;
    let timeoutFailure = false;

    const requestId = requestMeta?.requestId || randomUUID();
    const skill = input.skill.trim().toLowerCase();
    this.assertSupportedSkill(skill);

    try {
      const userId = this.enforceSkillAccess(skill, requestMeta?.headers);
      let aiCreditBalance: {
        allowed: boolean;
        monthlyLimit: number;
        usedCredits: number;
        remainingCredits: number;
      } | null = null;
      await this.enforceRateLimit(skill, requestMeta?.ip || 'unknown');

      const sanitizedPayload = this.buildSanitizedPayload(
        input,
        skill,
        requestId,
        userId,
      );
      this.logger.log(
        JSON.stringify({
          event: 'agent_assist_start',
          skill,
          requestId,
          ip: requestMeta?.ip || 'unknown',
          hasUserId: Boolean(userId),
        }),
      );

      const platformResponse = await this.callPlatform(
        sanitizedPayload,
        requestId,
        requestMeta?.ip,
      );
      if (userId) {
        aiCreditBalance = await this.billingService.consumeAiCredits({
          userId,
          credits: this.resolveAiCreditCost(skill),
          requestId,
        });
        if (!aiCreditBalance.allowed) {
          throw new BadRequestException(
            `AI credit limit reached for current period. Remaining credits: ${aiCreditBalance.remainingCredits}.`,
          );
        }
      }
      const suggestedActions = await this.decorateSuggestedActionsWithApproval({
        suggestedActions: platformResponse.suggestedActions,
        requestId,
        skill,
        userId,
      });

      const executedAction = await this.executeRequestedActionIfAllowed(
        input,
        suggestedActions,
        skill,
        userId,
        requestId,
      );

      return {
        version: platformResponse.version,
        skill: platformResponse.skill,
        requestId,
        assistantText: platformResponse.assistantText,
        intent: platformResponse.intent,
        confidence: platformResponse.confidence,
        suggestedActions: suggestedActions.map(
          (action): AgentSuggestedActionResponse => ({
            name: action.name,
            label: action.label,
            payloadJson:
              Object.keys(action.payload || {}).length > 0
                ? JSON.stringify(action.payload)
                : undefined,
            requiresApproval: Boolean(action.requiresApproval),
            approvalToken: action.approvalToken,
            approvalTokenExpiresAtIso: action.approvalTokenExpiresAtIso,
          }),
        ),
        safetyFlags: platformResponse.safetyFlags.map(
          (flag): AgentSafetyFlagResponse => ({
            code: flag.code,
            severity: flag.severity,
            message: flag.message,
          }),
        ),
        uiHintsJson:
          Object.keys(platformResponse.uiHints || {}).length > 0
            ? JSON.stringify(platformResponse.uiHints)
            : undefined,
        aiCreditsMonthlyLimit: aiCreditBalance?.monthlyLimit,
        aiCreditsUsed: aiCreditBalance?.usedCredits,
        aiCreditsRemaining: aiCreditBalance?.remainingCredits,
        executedAction: executedAction || undefined,
      };
    } catch (error) {
      failed = true;
      timeoutFailure = this.isTimeoutFailure(error);
      throw error;
    } finally {
      const latencyMs = Date.now() - startedAtMs;
      this.recordGatewayMetrics(latencyMs, failed, timeoutFailure);
      this.logAssistCompletion(
        requestId,
        skill,
        latencyMs,
        failed,
        timeoutFailure,
      );
    }
  }

  private assertSupportedSkill(skill: string): void {
    if (this.skillPolicies[skill]) return;
    throw new BadRequestException(
      `Unsupported skill '${skill}'. Currently available: ${Object.keys(
        this.skillPolicies,
      ).join(', ')}`,
    );
  }

  private resolveAiCreditCost(skill: string): number {
    const skillKey = skill.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const skillOverride = Number(
      process.env[`AI_AGENT_CREDIT_COST_${skillKey}`],
    );
    if (Number.isFinite(skillOverride) && skillOverride > 0) {
      return Math.floor(skillOverride);
    }

    const fallback = Number(process.env.AI_AGENT_CREDIT_COST || 1);
    if (Number.isFinite(fallback) && fallback > 0) {
      return Math.floor(fallback);
    }
    return 1;
  }

  async getPlatformHealth(): Promise<AgentPlatformHealthResponse> {
    const checkedAtIso = new Date().toISOString();
    const serviceUrl = this.getPlatformBaseUrl();
    const thresholdLatencyMs = this.getLatencyWarnThresholdMs();
    const thresholdErrorRate = this.getErrorRateWarnPercent();
    const requestCount = this.metrics.totalRequests;
    const errorCount = this.metrics.failedRequests;
    const timeoutErrorCount = this.metrics.timeoutFailures;
    const avgLatencyMs =
      requestCount > 0 ? this.metrics.totalLatencyMs / requestCount : 0;
    const errorRatePercent =
      requestCount > 0 ? (errorCount / requestCount) * 100 : 0;

    let reachable = false;
    let status = 'down';
    let latencyMs = 0;

    const startedAtMs = Date.now();
    try {
      const response = await axios.get<{ status?: string }>(
        `${serviceUrl}/health`,
        {
          timeout: this.getPlatformTimeoutMs(),
          headers: {
            'x-request-id': `health-${randomUUID()}`,
            ...(process.env.AI_AGENT_PLATFORM_KEY
              ? { 'x-agent-platform-key': process.env.AI_AGENT_PLATFORM_KEY }
              : {}),
          },
        },
      );
      latencyMs = Date.now() - startedAtMs;
      reachable = true;
      status = response.data?.status || 'ok';
    } catch {
      latencyMs = Date.now() - startedAtMs;
      reachable = false;
      status = 'down';
    }

    const alertingState = this.resolveAlertingState(
      reachable,
      avgLatencyMs,
      errorRatePercent,
      thresholdLatencyMs,
      thresholdErrorRate,
    );

    return {
      status,
      reachable,
      serviceUrl,
      latencyMs,
      checkedAtIso,
      requestCount,
      errorCount,
      timeoutErrorCount,
      errorRatePercent,
      avgLatencyMs,
      latencyWarnMs: thresholdLatencyMs,
      errorRateWarnPercent: thresholdErrorRate,
      alertingState,
    };
  }

  async listAgentActionAuditsForUser(input: {
    userId: string;
    limit?: number;
  }): Promise<AgentActionAudit[]> {
    const userId = String(input.userId || '').trim();
    if (!userId) {
      throw new BadRequestException('Authenticated user id is required');
    }
    const limit = Math.max(1, Math.min(100, input.limit || 20));
    return this.agentActionAuditRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private normalizeAuditExportLimit(limit?: number): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      return 200;
    }
    const rounded = Math.trunc(limit);
    if (rounded < AiAgentGatewayService.MIN_AUDIT_EXPORT_LIMIT) {
      return AiAgentGatewayService.MIN_AUDIT_EXPORT_LIMIT;
    }
    if (rounded > AiAgentGatewayService.MAX_AUDIT_EXPORT_LIMIT) {
      return AiAgentGatewayService.MAX_AUDIT_EXPORT_LIMIT;
    }
    return rounded;
  }

  private normalizeAuditRetentionDays(retentionDays?: number | null): number {
    if (typeof retentionDays !== 'number' || !Number.isFinite(retentionDays)) {
      return AiAgentGatewayService.DEFAULT_AUDIT_RETENTION_DAYS;
    }
    const rounded = Math.trunc(retentionDays);
    if (rounded < AiAgentGatewayService.MIN_AUDIT_RETENTION_DAYS) {
      return AiAgentGatewayService.MIN_AUDIT_RETENTION_DAYS;
    }
    if (rounded > AiAgentGatewayService.MAX_AUDIT_RETENTION_DAYS) {
      return AiAgentGatewayService.MAX_AUDIT_RETENTION_DAYS;
    }
    return rounded;
  }

  private resolveAuditRetentionDays(retentionDays?: number | null): number {
    const envValue = Number(process.env.AI_AGENT_ACTION_AUDIT_RETENTION_DAYS);
    const baseRetentionDays = this.normalizeAuditRetentionDays(
      Number.isFinite(envValue) ? envValue : undefined,
    );
    if (typeof retentionDays !== 'number' || !Number.isFinite(retentionDays)) {
      return baseRetentionDays;
    }
    return this.normalizeAuditRetentionDays(retentionDays);
  }

  async exportAgentActionDataForUser(input: {
    userId: string;
    limit?: number;
  }): Promise<{ generatedAtIso: string; dataJson: string }> {
    const userId = String(input.userId || '').trim();
    if (!userId) {
      throw new BadRequestException('Authenticated user id is required');
    }
    const limit = this.normalizeAuditExportLimit(input.limit);
    const audits = await this.agentActionAuditRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    const generatedAtIso = new Date().toISOString();
    const retentionDays = this.resolveAuditRetentionDays();
    const autoPurgeEnabled = String(
      process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    const dataJson = JSON.stringify({
      exportVersion: 'v1',
      generatedAtIso,
      userId,
      retentionPolicy: {
        retentionDays,
        autoPurgeEnabled: !['false', '0', 'off', 'no'].includes(
          autoPurgeEnabled,
        ),
      },
      summary: {
        totalAudits: audits.length,
        executedCount: audits.filter((audit) => audit.executed).length,
        blockedCount: audits.filter((audit) => !audit.executed).length,
        approvalRequiredCount: audits.filter((audit) => audit.approvalRequired)
          .length,
      },
      audits: audits.map((audit) => ({
        id: audit.id,
        requestId: audit.requestId,
        skill: audit.skill,
        action: audit.action,
        executed: audit.executed,
        approvalRequired: audit.approvalRequired,
        approvalTokenSuffix: audit.approvalTokenSuffix || null,
        message: audit.message,
        metadata: audit.metadata || null,
        createdAtIso: audit.createdAt.toISOString(),
        updatedAtIso: audit.updatedAt.toISOString(),
      })),
    });
    return {
      generatedAtIso,
      dataJson,
    };
  }

  async purgeAgentActionAuditRetentionData(input: {
    retentionDays?: number | null;
    userId?: string | null;
  }): Promise<{
    deletedRows: number;
    retentionDays: number;
    userScoped: boolean;
    executedAtIso: string;
  }> {
    const retentionDays = this.resolveAuditRetentionDays(input.retentionDays);
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const userId = String(input.userId || '').trim() || null;
    const deleteQuery = this.agentActionAuditRepo
      .createQueryBuilder()
      .delete()
      .from(AgentActionAudit)
      .where('"createdAt" < :cutoff', { cutoff: cutoffDate.toISOString() });
    if (userId) {
      deleteQuery.andWhere('"userId" = :userId', { userId });
    }
    const deleteResult = await deleteQuery.execute();
    const deletedRows = Number(deleteResult.affected || 0);
    const executedAtIso = new Date().toISOString();
    const userScoped = Boolean(userId);

    this.logger.log(
      `agent-action-audit: retention purge deletedRows=${deletedRows} retentionDays=${retentionDays} userScoped=${userScoped}`,
    );

    return {
      deletedRows,
      retentionDays,
      userScoped,
      executedAtIso,
    };
  }

  private enforceSkillAccess(
    skill: string,
    headers?: Record<string, string | string[] | undefined>,
  ): string | null {
    const policy = this.getSkillPolicy(skill);
    if (policy.access === 'public') return null;

    const token = this.extractRequestToken(headers);
    if (!token) {
      throw new UnauthorizedException(
        `Skill '${skill}' requires authentication token`,
      );
    }

    try {
      const user = this.authService.validateToken(token) as {
        id?: string;
      };
      if (!user?.id) {
        throw new UnauthorizedException('Authenticated skill missing user id');
      }
      return user.id;
    } catch {
      throw new UnauthorizedException(
        `Invalid or expired token for skill '${skill}'`,
      );
    }
  }

  private extractRequestToken(
    headers?: Record<string, string | string[] | undefined>,
  ): string | null {
    if (!headers) return null;
    return this.getCookieToken(headers) || this.getBearerToken(headers);
  }

  private getCookieToken(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    const rawCookie = headers.cookie;
    const cookieHeader = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
    if (!cookieHeader) return null;

    for (const token of cookieHeader.split(';')) {
      const [keyRaw, ...valueParts] = token.split('=');
      if (!keyRaw) continue;
      if (keyRaw.trim() !== 'token') continue;

      const cookieValue = valueParts.join('=').trim();
      if (!cookieValue) return null;
      try {
        return decodeURIComponent(cookieValue);
      } catch {
        return cookieValue;
      }
    }
    return null;
  }

  private getBearerToken(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    const rawAuth = headers.authorization;
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    if (!authHeader) return null;

    const [prefix, token] = authHeader.split(' ');
    if (!/^Bearer$/i.test(prefix) || !token) return null;
    return token;
  }

  private async enforceRateLimit(skill: string, ip: string): Promise<void> {
    const maxRequests = Number(process.env.AI_AGENT_GATEWAY_RATE_LIMIT || 40);
    const redisApplied = await this.enforceRateLimitUsingRedis(
      skill,
      ip,
      maxRequests,
    );
    if (redisApplied) return;
    this.enforceRateLimitInMemory(skill, ip, maxRequests);
  }

  private async enforceRateLimitUsingRedis(
    skill: string,
    ip: string,
    maxRequests: number,
  ): Promise<boolean> {
    if (!this.redisClient || !this.redisConnected) return false;

    const windowBucket = Math.floor(Date.now() / this.rateLimitWindowMs);
    const key = `ai-agent-rate:${skill}:${ip}:${windowBucket}`;
    try {
      const count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.expire(
          key,
          Math.ceil(this.rateLimitWindowMs / 1000),
        );
      }

      if (count > maxRequests) {
        throw new BadRequestException(
          'Too many assistant requests. Please try again soon.',
        );
      }
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `[agent-rate-limit] redis enforcement failed; using memory fallback: ${String(error)}`,
      );
      return false;
    }
  }

  private enforceRateLimitInMemory(
    skill: string,
    ip: string,
    maxRequests: number,
  ): void {
    const key = `${skill}:${ip}`;
    const nowMs = Date.now();
    const currentWindow = this.fallbackRateLimitCounters.get(key);

    if (
      !currentWindow ||
      nowMs - currentWindow.windowStartMs > this.rateLimitWindowMs
    ) {
      this.fallbackRateLimitCounters.set(key, {
        count: 1,
        windowStartMs: nowMs,
      });
      return;
    }

    if (currentWindow.count >= maxRequests) {
      throw new BadRequestException(
        'Too many assistant requests. Please try again soon.',
      );
    }

    currentWindow.count += 1;
    this.fallbackRateLimitCounters.set(key, currentWindow);
  }

  private shouldUseRedisRateLimit(): boolean {
    return (
      (process.env.AI_AGENT_GATEWAY_USE_REDIS || 'true').trim() !== 'false'
    );
  }

  private getRedisUrl(): string {
    return (
      process.env.AI_AGENT_GATEWAY_REDIS_URL ||
      process.env.REDIS_URL ||
      'redis://localhost:6379'
    );
  }

  private getSkillPolicy(skill: string): SkillPolicy {
    const policy = this.skillPolicies[skill];
    if (!policy) {
      throw new BadRequestException(`Unsupported skill '${skill}'`);
    }
    return policy;
  }

  private buildSanitizedPayload(
    input: AgentAssistInput,
    skill: string,
    requestId: string,
    userId: string | null,
  ): AgentPlatformPayload {
    const skillPolicy = this.getSkillPolicy(skill);
    const messages = input.messages.map((message) =>
      this.sanitizeMessage(message),
    );
    const requestedAllowedActions = (input.allowedActions || [])
      .map((action) => action.trim())
      .filter(Boolean);
    const candidateActions =
      requestedAllowedActions.length > 0
        ? requestedAllowedActions
        : Array.from(skillPolicy.allowedActions);
    const allowedActions = candidateActions.filter((action) =>
      skillPolicy.allowedActions.has(action),
    );
    const metadata = this.parseContextMetadata(input.context?.metadataJson);
    if (userId) metadata.userId = userId;
    metadata.requestId = requestId;

    return {
      version: 'v1',
      skill,
      requestId,
      messages,
      context: {
        surface: input.context?.surface || 'unknown',
        locale: input.context?.locale || 'en-IN',
        email: input.context?.email || null,
        metadata,
      },
      allowedActions,
      requestedAction: input.requestedAction || null,
      requestedActionPayload: {},
    };
  }

  private parseContextMetadata(metadataJson?: string): Record<string, string> {
    if (!metadataJson || metadataJson.trim().length === 0) return {};
    try {
      const parsed: unknown = JSON.parse(metadataJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return Object.entries(parsed as Record<string, unknown>).reduce<
        Record<string, string>
      >((accumulator, [key, value]) => {
        if (value === undefined || value === null) return accumulator;
        accumulator[key] =
          typeof value === 'string' ? value : JSON.stringify(value);
        return accumulator;
      }, {});
    } catch {
      return {};
    }
  }

  private sanitizeMessage(message: AgentMessageInput): {
    role: string;
    content: string;
  } {
    const maxChars = Number(
      process.env.AI_AGENT_PLATFORM_MAX_MSG_CHARS || 1200,
    );
    const truncated = message.content.slice(0, maxChars);
    const redacted = truncated
      .replace(
        /password\s*[:=]\s*([^\s]+)/gi,
        'password: [REDACTED_PASSWORD_VALUE]',
      )
      .replace(/token\s*[:=]\s*([^\s]+)/gi, 'token: [REDACTED_TOKEN_VALUE]');
    return {
      role: message.role,
      content: redacted,
    };
  }

  private getPlatformBaseUrl(): string {
    return process.env.AI_AGENT_PLATFORM_URL || 'http://localhost:8100';
  }

  private getPlatformTimeoutMs(): number {
    const parsed = Number(process.env.AI_AGENT_PLATFORM_TIMEOUT_MS || 4000);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    return 4000;
  }

  private async callPlatform(
    payload: AgentPlatformPayload,
    requestId: string,
    ip?: string,
  ): Promise<AgentPlatformResponse> {
    const url = `${this.getPlatformBaseUrl()}/v1/agent/respond`;
    const headers: Record<string, string> = {
      'x-request-id': requestId,
    };

    if (ip) headers['x-forwarded-for'] = ip;

    const platformKey = process.env.AI_AGENT_PLATFORM_KEY;
    if (platformKey) headers['x-agent-platform-key'] = platformKey;

    const maxRetries = Number(process.env.AI_AGENT_PLATFORM_RETRIES || 1);
    let lastError: unknown;
    let timeoutFailure = false;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await axios.post<AgentPlatformResponse>(url, payload, {
          timeout: this.getPlatformTimeoutMs(),
          headers,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        timeoutFailure =
          timeoutFailure ||
          (axios.isAxiosError(error) && error.code === 'ECONNABORTED');
        const statusCode = axios.isAxiosError(error)
          ? (error.response?.status ?? 'unknown')
          : 'unknown';
        this.logger.warn(
          JSON.stringify({
            event: 'agent_platform_call_failed',
            attempt: attempt + 1,
            requestId,
            statusCode,
            timeoutFailure,
          }),
        );
      }
    }

    const finalStatus = axios.isAxiosError(lastError)
      ? (lastError.response?.status ?? 'unknown')
      : 'unknown';
    this.logger.error(
      JSON.stringify({
        event: 'agent_platform_unavailable',
        requestId,
        finalStatus,
        timeoutFailure,
      }),
    );
    throw new ServiceUnavailableException({
      message: 'AI assistant is temporarily unavailable',
      code: timeoutFailure ? 'AI_AGENT_TIMEOUT' : 'AI_AGENT_UNAVAILABLE',
      requestId,
    });
  }

  private async decorateSuggestedActionsWithApproval(input: {
    suggestedActions: Array<{
      name: string;
      label: string;
      payload: Record<string, string>;
    }>;
    requestId: string;
    skill: string;
    userId: string | null;
  }): Promise<GatewaySuggestedAction[]> {
    const skillPolicy = this.getSkillPolicy(input.skill);
    const result: GatewaySuggestedAction[] = [];
    for (const action of input.suggestedActions) {
      const requiresApproval = skillPolicy.humanApprovalActions.has(
        action.name,
      );
      if (!requiresApproval || !input.userId) {
        result.push({
          ...action,
          requiresApproval: false,
        });
        continue;
      }
      const approval = await this.createActionApprovalToken({
        action: action.name,
        skill: input.skill,
        userId: input.userId,
        requestId: input.requestId,
      });
      result.push({
        ...action,
        requiresApproval: true,
        approvalToken: approval.token,
        approvalTokenExpiresAtIso: new Date(approval.expiresAtMs).toISOString(),
      });
    }
    return result;
  }

  private async assertActionApprovalIfRequired(input: {
    skill: string;
    skillPolicy: SkillPolicy;
    requestedAction: string;
    userId: string | null;
    requestedApprovalToken?: string;
  }): Promise<void> {
    if (!input.skillPolicy.humanApprovalActions.has(input.requestedAction)) {
      return;
    }
    if (!input.userId) {
      throw new BadRequestException(
        `Action '${input.requestedAction}' requires authenticated user approval`,
      );
    }
    const requestedApprovalToken = String(
      input.requestedApprovalToken || '',
    ).trim();
    if (!requestedApprovalToken) {
      throw new BadRequestException(
        `Action '${input.requestedAction}' requires human approval token`,
      );
    }
    const isValidApproval = await this.consumeActionApprovalToken({
      token: requestedApprovalToken,
      action: input.requestedAction,
      skill: input.skill,
      userId: input.userId,
    });
    if (!isValidApproval) {
      throw new BadRequestException(
        `Action '${input.requestedAction}' has invalid or expired approval token`,
      );
    }
  }

  private async createActionApprovalToken(input: {
    action: string;
    skill: string;
    userId: string;
    requestId: string;
  }): Promise<PendingActionApproval> {
    const token = `appr_${randomUUID()}`;
    const expiresAtMs = Date.now() + this.getActionApprovalTtlMs();
    const pendingApproval: PendingActionApproval = {
      token,
      action: input.action,
      skill: input.skill,
      userId: input.userId,
      requestId: input.requestId,
      expiresAtMs,
    };
    const persistedToRedis =
      await this.storeActionApprovalInRedis(pendingApproval);
    if (!persistedToRedis) {
      this.fallbackPendingApprovals.set(token, pendingApproval);
      this.compactExpiredFallbackApprovals();
    }
    return pendingApproval;
  }

  private async consumeActionApprovalToken(input: {
    token: string;
    action: string;
    skill: string;
    userId: string;
  }): Promise<boolean> {
    const normalizedToken = String(input.token || '').trim();
    if (!normalizedToken) return false;

    const fromRedis =
      await this.consumeActionApprovalFromRedis(normalizedToken);
    if (fromRedis) {
      return this.matchesApprovalRecord(fromRedis, input);
    }

    const fallback = this.fallbackPendingApprovals.get(normalizedToken);
    if (!fallback) return false;
    this.fallbackPendingApprovals.delete(normalizedToken);
    return this.matchesApprovalRecord(fallback, input);
  }

  private matchesApprovalRecord(
    approval: PendingActionApproval,
    expected: {
      action: string;
      skill: string;
      userId: string;
    },
  ): boolean {
    if (approval.expiresAtMs < Date.now()) return false;
    if (approval.action !== expected.action) return false;
    if (approval.skill !== expected.skill) return false;
    if (approval.userId !== expected.userId) return false;
    return true;
  }

  private async storeActionApprovalInRedis(
    approval: PendingActionApproval,
  ): Promise<boolean> {
    if (!this.redisClient || !this.redisConnected) return false;
    try {
      const key = this.getActionApprovalKey(approval.token);
      const ttlSeconds = Math.max(
        1,
        Math.ceil((approval.expiresAtMs - Date.now()) / 1000),
      );
      await this.redisClient.set(key, JSON.stringify(approval), {
        EX: ttlSeconds,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `[agent-approval] redis store failed; using memory fallback: ${String(error)}`,
      );
      return false;
    }
  }

  private async consumeActionApprovalFromRedis(
    token: string,
  ): Promise<PendingActionApproval | null> {
    if (!this.redisClient || !this.redisConnected) return null;
    const key = this.getActionApprovalKey(token);
    try {
      const rawValue = await this.redisClient.get(key);
      if (!rawValue) return null;
      await this.redisClient.del(key);
      const parsed = JSON.parse(rawValue) as Partial<PendingActionApproval>;
      if (
        !parsed ||
        typeof parsed.action !== 'string' ||
        typeof parsed.skill !== 'string' ||
        typeof parsed.userId !== 'string' ||
        typeof parsed.token !== 'string' ||
        typeof parsed.requestId !== 'string' ||
        typeof parsed.expiresAtMs !== 'number'
      ) {
        return null;
      }
      return {
        token: parsed.token,
        action: parsed.action,
        skill: parsed.skill,
        userId: parsed.userId,
        requestId: parsed.requestId,
        expiresAtMs: parsed.expiresAtMs,
      };
    } catch (error) {
      this.logger.warn(
        `[agent-approval] redis consume failed; using memory fallback: ${String(error)}`,
      );
      return null;
    }
  }

  private compactExpiredFallbackApprovals(): void {
    const nowMs = Date.now();
    for (const [token, approval] of this.fallbackPendingApprovals.entries()) {
      if (approval.expiresAtMs >= nowMs) continue;
      this.fallbackPendingApprovals.delete(token);
    }
  }

  private getActionApprovalKey(token: string): string {
    return `ai-agent-approval:${token}`;
  }

  private getActionApprovalTtlMs(): number {
    const rawSeconds = Number(
      process.env.AI_AGENT_ACTION_APPROVAL_TTL_SECONDS || 10 * 60,
    );
    const normalizedSeconds = Number.isFinite(rawSeconds)
      ? Math.floor(rawSeconds)
      : 10 * 60;
    if (normalizedSeconds < 30) return 30 * 1000;
    if (normalizedSeconds > 24 * 60 * 60) return 24 * 60 * 60 * 1000;
    return normalizedSeconds * 1000;
  }

  private async executeRequestedActionIfAllowed(
    input: AgentAssistInput,
    suggestedActions: GatewaySuggestedAction[],
    skill: string,
    userId: string | null,
    requestId: string,
  ): Promise<AgentActionExecutionResponse | null> {
    if (!input.executeRequestedAction || !input.requestedAction) {
      return null;
    }

    const skillPolicy = this.getSkillPolicy(skill);
    const requestedAction = input.requestedAction.trim();
    const suggestedActionNames = new Set(
      suggestedActions.map((action) => action.name),
    );

    if (!suggestedActionNames.has(requestedAction)) {
      throw new BadRequestException(
        `Action '${requestedAction}' must be suggested by the agent first`,
      );
    }

    await this.assertActionApprovalIfRequired({
      skill,
      skillPolicy,
      requestedAction,
      userId,
      requestedApprovalToken: input.requestedActionApprovalToken,
    });

    if (!skillPolicy.serverExecutableActions.has(requestedAction)) {
      return this.finalizeActionExecution({
        action: requestedAction,
        executed: false,
        message:
          'Action is approved but not executable on backend; handle it in UI flow.',
        skill,
        userId,
        requestId,
        approvalRequired: skillPolicy.humanApprovalActions.has(requestedAction),
        requestedApprovalToken: input.requestedActionApprovalToken,
      });
    }

    if (requestedAction === 'auth.forgot_password') {
      const normalizedEmail = input.context?.email?.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new BadRequestException(
          'Email is required to execute forgot password action',
        );
      }

      const user = await this.userRepo.findOne({
        where: { email: normalizedEmail },
      });
      if (user) {
        await this.authService.createVerificationToken(
          user.id,
          'PASSWORD_RESET',
        );
      }

      return this.finalizeActionExecution({
        action: requestedAction,
        executed: true,
        message:
          'If an account exists for this email, a password reset flow has been initiated.',
        skill,
        userId,
        requestId,
        approvalRequired: skillPolicy.humanApprovalActions.has(requestedAction),
        requestedApprovalToken: input.requestedActionApprovalToken,
        metadata: {
          email: normalizedEmail,
        },
      });
    }

    if (requestedAction === 'inbox.summarize_thread') {
      if (!userId) {
        throw new BadRequestException(
          'Authenticated user is required for inbox summary action',
        );
      }

      const metadata = this.parseContextMetadata(input.context?.metadataJson);
      const threadId =
        metadata.threadId ||
        metadata.emailThreadId ||
        metadata.messageThreadId ||
        '';
      const summary = await this.summarizeThreadForUser(
        userId,
        threadId || undefined,
      );

      return this.finalizeActionExecution({
        action: requestedAction,
        executed: true,
        message: summary,
        skill,
        userId,
        requestId,
        approvalRequired: skillPolicy.humanApprovalActions.has(requestedAction),
        requestedApprovalToken: input.requestedActionApprovalToken,
        metadata: {
          threadId: threadId || null,
        },
      });
    }

    if (requestedAction === 'inbox.compose_reply_draft') {
      if (!userId) {
        throw new BadRequestException(
          'Authenticated user is required for inbox draft action',
        );
      }

      const metadata = this.parseContextMetadata(input.context?.metadataJson);
      const threadId =
        metadata.threadId ||
        metadata.emailThreadId ||
        metadata.messageThreadId ||
        '';
      const draft = await this.composeReplyDraftForUser(
        userId,
        threadId || undefined,
      );

      return this.finalizeActionExecution({
        action: requestedAction,
        executed: true,
        message: draft,
        skill,
        userId,
        requestId,
        approvalRequired: skillPolicy.humanApprovalActions.has(requestedAction),
        requestedApprovalToken: input.requestedActionApprovalToken,
        metadata: {
          threadId: threadId || null,
        },
      });
    }

    if (requestedAction === 'inbox.schedule_followup') {
      if (!userId) {
        throw new BadRequestException(
          'Authenticated user is required for follow-up scheduling action',
        );
      }

      const metadata = this.parseContextMetadata(input.context?.metadataJson);
      const threadId =
        metadata.threadId ||
        metadata.emailThreadId ||
        metadata.messageThreadId ||
        '';
      const followupAtIso = metadata.followupAt || metadata.followupAtIso;
      const workspaceId = metadata.workspaceId || metadata.activeWorkspaceId;
      const providerId = metadata.providerId || metadata.activeProviderId;
      const followupLabel = followupAtIso || 'the requested time';

      await this.notificationEventBus.publishSafely({
        userId,
        type: 'AGENT_ACTION_REQUIRED',
        title: 'Follow-up reminder scheduled',
        message: `MailZen AI scheduled a follow-up reminder for ${followupLabel}.`,
        metadata: {
          threadId: threadId || undefined,
          followupAt: followupAtIso || undefined,
          workspaceId: workspaceId || undefined,
          providerId: providerId || undefined,
          sourceAction: requestedAction,
        },
      });

      return this.finalizeActionExecution({
        action: requestedAction,
        executed: true,
        message: `Follow-up reminder scheduled for ${followupLabel}.`,
        skill,
        userId,
        requestId,
        approvalRequired: skillPolicy.humanApprovalActions.has(requestedAction),
        requestedApprovalToken: input.requestedActionApprovalToken,
        metadata: {
          threadId: threadId || null,
          followupAtIso: followupAtIso || null,
          workspaceId: workspaceId || null,
          providerId: providerId || null,
        },
      });
    }

    throw new BadRequestException(
      `Unsupported executable action '${requestedAction}'`,
    );
  }

  private async finalizeActionExecution(input: {
    action: string;
    executed: boolean;
    message: string;
    skill: string;
    userId: string | null;
    requestId: string;
    approvalRequired: boolean;
    requestedApprovalToken?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentActionExecutionResponse> {
    await this.recordAgentActionAudit(input);
    return {
      action: input.action,
      executed: input.executed,
      message: input.message,
    };
  }

  private async recordAgentActionAudit(input: {
    action: string;
    executed: boolean;
    message: string;
    skill: string;
    userId: string | null;
    requestId: string;
    approvalRequired: boolean;
    requestedApprovalToken?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const approvalTokenSuffix = this.resolveApprovalTokenSuffix(
        input.requestedApprovalToken,
      );
      const audit = this.agentActionAuditRepo.create({
        userId: input.userId,
        requestId: input.requestId,
        skill: input.skill,
        action: input.action,
        executed: input.executed,
        approvalRequired: input.approvalRequired,
        approvalTokenSuffix,
        message: input.message,
        metadata: input.metadata || null,
      });
      await this.agentActionAuditRepo.save(audit);
    } catch (error) {
      this.logger.warn(
        `agent-action-audit: failed persist requestId=${input.requestId} action=${input.action} error=${String(error)}`,
      );
    }
  }

  private resolveApprovalTokenSuffix(rawToken?: string): string | null {
    const normalized = String(rawToken || '').trim();
    if (!normalized) return null;
    if (normalized.length <= 8) return normalized;
    return normalized.slice(-8);
  }

  private async summarizeThreadForUser(
    userId: string,
    threadId?: string,
  ): Promise<string> {
    const messages = await this.externalEmailMessageRepo.find({
      where: threadId ? { userId, threadId } : { userId },
      order: { internalDate: 'DESC', createdAt: 'DESC' },
      take: 5,
    });

    if (!messages.length) {
      return 'No email messages were found for this thread yet.';
    }

    const subject = messages[0]?.subject || 'Untitled thread';
    const bulletPoints = messages
      .slice(0, 3)
      .map((message, index) => {
        const from = message.from || 'unknown sender';
        const snippet = (message.snippet || 'No preview available')
          .replace(/\s+/g, ' ')
          .trim();
        return `${index + 1}. ${from}: ${snippet}`;
      })
      .join(' ');

    return `Thread "${subject}" summary: ${bulletPoints}`;
  }

  private async composeReplyDraftForUser(
    userId: string,
    threadId?: string,
  ): Promise<string> {
    const messages = await this.externalEmailMessageRepo.find({
      where: threadId ? { userId, threadId } : { userId },
      order: { internalDate: 'DESC', createdAt: 'DESC' },
      take: 1,
    });

    const latest = messages[0];
    if (!latest) {
      return 'Draft reply: Thank you for your message. I will review and get back to you shortly.';
    }

    const sender = latest.from || 'there';
    const subject = latest.subject || 'your email';
    const snippet = (latest.snippet || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);

    return [
      `Draft reply for "${subject}":`,
      '',
      `Hi ${sender},`,
      '',
      'Thank you for your email. I have reviewed your note and appreciate the context you shared.',
      snippet
        ? `Regarding your message (“${snippet}”), I will proceed with the required next steps and share a clear update shortly.`
        : 'I will proceed with the required next steps and share a clear update shortly.',
      '',
      'Best regards,',
      'MailZen User',
    ].join('\n');
  }

  private recordGatewayMetrics(
    latencyMs: number,
    failed: boolean,
    timeoutFailure: boolean,
  ): void {
    this.metrics.totalRequests += 1;
    this.metrics.totalLatencyMs += latencyMs;
    this.metrics.lastLatencyMs = latencyMs;
    if (failed) {
      this.metrics.failedRequests += 1;
      this.metrics.lastErrorAtIso = new Date().toISOString();
    }
    if (timeoutFailure) {
      this.metrics.timeoutFailures += 1;
    }
  }

  private logAssistCompletion(
    requestId: string,
    skill: string,
    latencyMs: number,
    failed: boolean,
    timeoutFailure: boolean,
  ): void {
    const payload = {
      event: 'agent_assist_complete',
      requestId,
      skill,
      latencyMs,
      failed,
      timeoutFailure,
      totalRequests: this.metrics.totalRequests,
    };

    if (latencyMs > this.getLatencyWarnThresholdMs()) {
      this.logger.warn(JSON.stringify(payload));
      return;
    }
    this.logger.log(JSON.stringify(payload));
  }

  private getLatencyWarnThresholdMs(): number {
    const value = Number(process.env.AI_AGENT_ALERT_LATENCY_MS || 1500);
    return Number.isFinite(value) && value > 0 ? value : 1500;
  }

  private getErrorRateWarnPercent(): number {
    const value = Number(process.env.AI_AGENT_ALERT_ERROR_RATE_PERCENT || 5);
    return Number.isFinite(value) && value >= 0 ? value : 5;
  }

  private resolveAlertingState(
    reachable: boolean,
    avgLatencyMs: number,
    errorRatePercent: number,
    latencyWarnMs: number,
    errorRateWarnPercent: number,
  ): string {
    if (!reachable) return 'critical';
    if (errorRatePercent >= errorRateWarnPercent) return 'warn';
    if (avgLatencyMs >= latencyWarnMs) return 'warn';
    return 'healthy';
  }

  private isTimeoutFailure(error: unknown): boolean {
    if (!(error instanceof ServiceUnavailableException)) return false;
    const response = error.getResponse();
    if (typeof response !== 'object' || !response) return false;
    const code = (response as { code?: string }).code;
    return code === 'AI_AGENT_TIMEOUT';
  }
}
