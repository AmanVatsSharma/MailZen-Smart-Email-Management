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
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { NotificationService } from '../notification/notification.service';
import { User } from '../user/entities/user.entity';
import { AgentAssistInput, AgentMessageInput } from './dto/agent-assist.input';
import { AgentPlatformHealthResponse } from './dto/agent-platform-health.response';
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
  private readonly rateLimitWindowMs = 60_000;
  private readonly fallbackRateLimitCounters = new Map<
    string,
    { count: number; windowStartMs: number }
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
    },
  };

  constructor(
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ExternalEmailMessage)
    private readonly externalEmailMessageRepo: Repository<ExternalEmailMessage>,
    private readonly notificationService: NotificationService,
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

      const executedAction = await this.executeRequestedActionIfAllowed(
        input,
        platformResponse,
        skill,
        userId,
      );

      return {
        version: platformResponse.version,
        skill: platformResponse.skill,
        requestId,
        assistantText: platformResponse.assistantText,
        intent: platformResponse.intent,
        confidence: platformResponse.confidence,
        suggestedActions: platformResponse.suggestedActions.map(
          (action): AgentSuggestedActionResponse => ({
            name: action.name,
            label: action.label,
            payloadJson:
              Object.keys(action.payload || {}).length > 0
                ? JSON.stringify(action.payload)
                : undefined,
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

  private async executeRequestedActionIfAllowed(
    input: AgentAssistInput,
    platformResponse: AgentPlatformResponse,
    skill: string,
    userId: string | null,
  ): Promise<AgentActionExecutionResponse | null> {
    if (!input.executeRequestedAction || !input.requestedAction) {
      return null;
    }

    const skillPolicy = this.getSkillPolicy(skill);
    const requestedAction = input.requestedAction.trim();
    const suggestedActionNames = new Set(
      platformResponse.suggestedActions.map((action) => action.name),
    );

    if (!suggestedActionNames.has(requestedAction)) {
      throw new BadRequestException(
        `Action '${requestedAction}' must be suggested by the agent first`,
      );
    }

    if (!skillPolicy.serverExecutableActions.has(requestedAction)) {
      return {
        action: requestedAction,
        executed: false,
        message:
          'Action is approved but not executable on backend; handle it in UI flow.',
      };
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

      return {
        action: requestedAction,
        executed: true,
        message:
          'If an account exists for this email, a password reset flow has been initiated.',
      };
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

      return {
        action: requestedAction,
        executed: true,
        message: summary,
      };
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

      return {
        action: requestedAction,
        executed: true,
        message: draft,
      };
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
      const followupLabel = followupAtIso || 'the requested time';

      await this.notificationService.createNotification({
        userId,
        type: 'AGENT_ACTION_REQUIRED',
        title: 'Follow-up reminder scheduled',
        message: `MailZen AI scheduled a follow-up reminder for ${followupLabel}.`,
        metadata: {
          threadId: threadId || undefined,
          followupAt: followupAtIso || undefined,
          sourceAction: requestedAction,
        },
      });

      return {
        action: requestedAction,
        executed: true,
        message: `Follow-up reminder scheduled for ${followupLabel}.`,
      };
    }

    throw new BadRequestException(
      `Unsupported executable action '${requestedAction}'`,
    );
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
