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
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { User } from '../user/entities/user.entity';
import { AgentAssistInput, AgentMessageInput } from './dto/agent-assist.input';
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
}

@Injectable()
export class AiAgentGatewayService {
  private readonly logger = new Logger(AiAgentGatewayService.name);
  private readonly supportedSkills = new Set(['auth', 'auth-login']);
  private readonly allowedActionPrefix = 'auth.';
  private readonly rateLimitWindowMs = 60_000;
  private readonly rateLimitCounters = new Map<
    string,
    { count: number; windowStartMs: number }
  >();

  constructor(
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async assist(
    input: AgentAssistInput,
    requestMeta?: GatewayRequestMeta,
  ): Promise<AgentAssistResponse> {
    const requestId = requestMeta?.requestId || randomUUID();
    const skill = input.skill.trim().toLowerCase();
    this.assertSupportedSkill(skill);
    this.enforceRateLimit(requestMeta?.ip || 'unknown');

    const sanitizedPayload = this.buildSanitizedPayload(
      input,
      skill,
      requestId,
    );
    this.logger.log(`assist start skill=${skill} requestId=${requestId}`);
    const platformResponse = await this.callPlatform(
      sanitizedPayload,
      requestId,
      requestMeta?.ip,
    );

    const executedAction = await this.executeRequestedActionIfAllowed(
      input,
      platformResponse,
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
  }

  private enforceRateLimit(ip: string): void {
    const maxRequests = Number(process.env.AI_AGENT_GATEWAY_RATE_LIMIT || 40);
    const nowMs = Date.now();
    const currentWindow = this.rateLimitCounters.get(ip);

    if (
      !currentWindow ||
      nowMs - currentWindow.windowStartMs > this.rateLimitWindowMs
    ) {
      this.rateLimitCounters.set(ip, { count: 1, windowStartMs: nowMs });
      return;
    }

    if (currentWindow.count >= maxRequests) {
      throw new BadRequestException(
        'Too many assistant requests. Please try again soon.',
      );
    }

    currentWindow.count += 1;
    this.rateLimitCounters.set(ip, currentWindow);
  }

  private assertSupportedSkill(skill: string): void {
    if (this.supportedSkills.has(skill)) return;
    throw new BadRequestException(
      `Unsupported skill '${skill}'. Currently available: auth`,
    );
  }

  private buildSanitizedPayload(
    input: AgentAssistInput,
    skill: string,
    requestId: string,
  ): AgentPlatformPayload {
    const messages = input.messages.map((message) =>
      this.sanitizeMessage(message),
    );
    const allowedActions = (input.allowedActions || [])
      .map((action) => action.trim())
      .filter((action) => action.startsWith(this.allowedActionPrefix));

    return {
      version: 'v1',
      skill,
      requestId,
      messages,
      context: {
        surface: input.context?.surface || 'unknown',
        locale: input.context?.locale || 'en-IN',
        email: input.context?.email || null,
        metadata: {},
      },
      allowedActions,
      requestedAction: input.requestedAction || null,
      requestedActionPayload: {},
    };
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

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await axios.post<AgentPlatformResponse>(url, payload, {
          timeout: this.getPlatformTimeoutMs(),
          headers,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        const statusCode = axios.isAxiosError(error)
          ? (error.response?.status ?? 'unknown')
          : 'unknown';
        this.logger.warn(
          `Agent platform call attempt=${attempt + 1} failed requestId=${requestId} status=${statusCode}`,
        );
      }
    }

    const finalStatus = axios.isAxiosError(lastError)
      ? (lastError.response?.status ?? 'unknown')
      : 'unknown';
    this.logger.error(
      `Agent platform unavailable requestId=${requestId} status=${finalStatus}`,
    );
    throw new ServiceUnavailableException(
      'AI assistant is temporarily unavailable',
    );
  }

  private async executeRequestedActionIfAllowed(
    input: AgentAssistInput,
    platformResponse: AgentPlatformResponse,
  ): Promise<AgentActionExecutionResponse | null> {
    if (!input.executeRequestedAction || !input.requestedAction) {
      return null;
    }

    const requestedAction = input.requestedAction.trim();
    const suggestedActionNames = new Set(
      platformResponse.suggestedActions.map((action) => action.name),
    );

    if (!suggestedActionNames.has(requestedAction)) {
      throw new BadRequestException(
        `Action '${requestedAction}' must be suggested by the agent first`,
      );
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

    return {
      action: requestedAction,
      executed: false,
      message:
        'This action is currently UI-only and should be handled in client.',
    };
  }
}
