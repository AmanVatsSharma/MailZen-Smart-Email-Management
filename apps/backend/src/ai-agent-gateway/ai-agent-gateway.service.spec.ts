/**
 * File: apps/backend/src/ai-agent-gateway/ai-agent-gateway.service.spec.ts
 * Module: ai-agent-gateway
 * Purpose: Unit tests for gateway policy and execution behavior.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - Mocks Python platform responses via axios.
 * - Read assist() assertions first.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from 'axios';
import { createHash } from 'crypto';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { BillingService } from '../billing/billing.service';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { User } from '../user/entities/user.entity';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { AgentAssistInput } from './dto/agent-assist.input';
import { AgentActionAudit } from './entities/agent-action-audit.entity';
import { AgentPlatformEndpointRuntimeStat } from './entities/agent-platform-endpoint-runtime-stat.entity';
import { AgentPlatformHealthSample } from './entities/agent-platform-health-sample.entity';
import { AgentPlatformSkillRuntimeStat } from './entities/agent-platform-skill-runtime-stat.entity';
import { AiAgentGatewayService } from './ai-agent-gateway.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AiAgentGatewayService', () => {
  const createVerificationTokenMock = jest.fn();
  const findOneMock = jest.fn();
  const findExternalMessagesMock = jest.fn();
  const findWorkspaceMemberMock = jest.fn();
  const createNotificationMock = jest.fn();
  const findAgentActionAuditMock = jest.fn();
  const createAgentActionAuditMock = jest.fn();
  const saveAgentActionAuditMock = jest.fn();
  const deleteWhereMock = jest.fn();
  const deleteAndWhereMock = jest.fn();
  const deleteExecuteMock = jest.fn();
  const findEndpointRuntimeStatsMock = jest.fn();
  const upsertEndpointRuntimeStatMock = jest.fn();
  const deleteEndpointRuntimeStatsMock = jest.fn();
  const saveHealthSampleMock = jest.fn();
  const findHealthSamplesMock = jest.fn();
  const deleteHealthSamplesMock = jest.fn();
  const findSkillRuntimeStatsMock = jest.fn();
  const upsertSkillRuntimeStatMock = jest.fn();
  const deleteSkillRuntimeStatsMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();

  const authService = {
    createVerificationToken: createVerificationTokenMock,
    validateToken: jest.fn().mockReturnValue({ id: 'user-1' }),
  } as unknown as Pick<
    AuthService,
    'createVerificationToken' | 'validateToken'
  >;

  const userRepo = {
    findOne: findOneMock,
  } as unknown as Pick<Repository<User>, 'findOne'>;
  const externalEmailMessageRepo = {
    find: findExternalMessagesMock,
  } as unknown as Pick<Repository<ExternalEmailMessage>, 'find'>;
  const workspaceMemberRepo = {
    findOne: findWorkspaceMemberMock,
  } as unknown as Pick<Repository<WorkspaceMember>, 'findOne'>;
  const agentActionAuditRepo = {
    find: findAgentActionAuditMock,
    create: createAgentActionAuditMock,
    save: saveAgentActionAuditMock,
    createQueryBuilder: jest.fn(() => ({
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: deleteWhereMock.mockReturnThis(),
      andWhere: deleteAndWhereMock.mockReturnThis(),
      execute: deleteExecuteMock,
    })),
  } as unknown as Pick<
    Repository<AgentActionAudit>,
    'find' | 'create' | 'save' | 'createQueryBuilder'
  >;
  const notificationEventBus = {
    publishSafely: createNotificationMock,
  } as unknown as Pick<NotificationEventBusService, 'publishSafely'>;
  const endpointRuntimeStatRepo = {
    find: findEndpointRuntimeStatsMock,
    upsert: upsertEndpointRuntimeStatMock,
    delete: deleteEndpointRuntimeStatsMock,
  } as unknown as Pick<
    Repository<AgentPlatformEndpointRuntimeStat>,
    'find' | 'upsert' | 'delete'
  >;
  const healthSampleRepo = {
    save: saveHealthSampleMock,
    find: findHealthSamplesMock,
    delete: deleteHealthSamplesMock,
  } as unknown as Pick<
    Repository<AgentPlatformHealthSample>,
    'save' | 'find' | 'delete'
  >;
  const skillRuntimeStatRepo = {
    find: findSkillRuntimeStatsMock,
    upsert: upsertSkillRuntimeStatMock,
    delete: deleteSkillRuntimeStatsMock,
  } as unknown as Pick<
    Repository<AgentPlatformSkillRuntimeStat>,
    'find' | 'upsert' | 'delete'
  >;
  const auditLogRepo = {
    create: createAuditLogMock,
    save: saveAuditLogMock,
  } as unknown as Pick<Repository<AuditLog>, 'create' | 'save'>;
  const billingService = {
    consumeAiCredits: jest.fn().mockResolvedValue({
      allowed: true,
      planCode: 'PRO',
      monthlyLimit: 500,
      usedCredits: 10,
      remainingCredits: 490,
      periodStart: '2026-02-01',
      requestedCredits: 1,
      lastConsumedAtIso: null,
    }),
  } as unknown as Pick<BillingService, 'consumeAiCredits'>;

  const createService = () =>
    new AiAgentGatewayService(
      authService as AuthService,
      billingService as BillingService,
      userRepo as Repository<User>,
      externalEmailMessageRepo as Repository<ExternalEmailMessage>,
      workspaceMemberRepo as Repository<WorkspaceMember>,
      agentActionAuditRepo as Repository<AgentActionAudit>,
      endpointRuntimeStatRepo as Repository<AgentPlatformEndpointRuntimeStat>,
      healthSampleRepo as Repository<AgentPlatformHealthSample>,
      skillRuntimeStatRepo as Repository<AgentPlatformSkillRuntimeStat>,
      auditLogRepo as Repository<AuditLog>,
      notificationEventBus as NotificationEventBusService,
    );
  const originalPlatformUrls = process.env.AI_AGENT_PLATFORM_URLS;
  const originalLoadBalanceEnabled =
    process.env.AI_AGENT_PLATFORM_LOAD_BALANCE_ENABLED;
  const originalUseRedisRateLimit = process.env.AI_AGENT_GATEWAY_USE_REDIS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AI_AGENT_PLATFORM_URLS;
    delete process.env.AI_AGENT_PLATFORM_LOAD_BALANCE_ENABLED;
    delete process.env.AI_AGENT_GATEWAY_USE_REDIS;
    createAgentActionAuditMock.mockImplementation(
      (value: Record<string, unknown>) => value,
    );
    saveAgentActionAuditMock.mockResolvedValue({ id: 'audit-1' });
    findAgentActionAuditMock.mockResolvedValue([]);
    findWorkspaceMemberMock.mockResolvedValue(null);
    deleteExecuteMock.mockResolvedValue({ affected: 0 });
    findEndpointRuntimeStatsMock.mockResolvedValue([]);
    upsertEndpointRuntimeStatMock.mockResolvedValue(undefined);
    deleteEndpointRuntimeStatsMock.mockResolvedValue({ affected: 0 });
    saveHealthSampleMock.mockResolvedValue({ id: 'sample-1' });
    findHealthSamplesMock.mockResolvedValue([]);
    deleteHealthSamplesMock.mockResolvedValue({ affected: 0 });
    findSkillRuntimeStatsMock.mockResolvedValue([]);
    upsertSkillRuntimeStatMock.mockResolvedValue(undefined);
    deleteSkillRuntimeStatsMock.mockResolvedValue({ affected: 0 });
    createAuditLogMock.mockImplementation(
      (value: Record<string, unknown>) => value,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' });
    (billingService.consumeAiCredits as jest.Mock).mockResolvedValue({
      allowed: true,
      planCode: 'PRO',
      monthlyLimit: 500,
      usedCredits: 10,
      remainingCredits: 490,
      periodStart: '2026-02-01',
      requestedCredits: 1,
      lastConsumedAtIso: null,
    });
  });

  afterAll(() => {
    if (typeof originalPlatformUrls === 'string') {
      process.env.AI_AGENT_PLATFORM_URLS = originalPlatformUrls;
    } else {
      delete process.env.AI_AGENT_PLATFORM_URLS;
    }
    if (typeof originalLoadBalanceEnabled === 'string') {
      process.env.AI_AGENT_PLATFORM_LOAD_BALANCE_ENABLED =
        originalLoadBalanceEnabled;
    } else {
      delete process.env.AI_AGENT_PLATFORM_LOAD_BALANCE_ENABLED;
    }
    if (typeof originalUseRedisRateLimit === 'string') {
      process.env.AI_AGENT_GATEWAY_USE_REDIS = originalUseRedisRateLimit;
    } else {
      delete process.env.AI_AGENT_GATEWAY_USE_REDIS;
    }
  });

  it('redacts sensitive fields before platform call', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'Use forgot password.',
        intent: 'forgot_password',
        confidence: 0.9,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);

    const input: AgentAssistInput = {
      skill: 'auth',
      messages: [
        {
          role: 'user',
          content: 'my password: hunter2 token=abc123',
        },
      ],
      context: { surface: 'auth-login', locale: 'en-IN', email: 'a@b.com' },
      allowedActions: ['auth.forgot_password'],
      executeRequestedAction: false,
    };

    await service.assist(input);

    const firstPostCall = mockedAxios.post.mock.calls[0];
    const payload = firstPostCall[1] as {
      messages: Array<{ content: string }>;
    };
    expect(payload.messages[0].content).not.toContain('hunter2');
    expect(payload.messages[0].content).not.toContain('abc123');
  });

  it('executes forgot-password action only when suggested', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'I can send reset link.',
        intent: 'forgot_password',
        confidence: 0.92,
        suggestedActions: [
          {
            name: 'auth.forgot_password',
            label: 'Send password reset link',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findOneMock.mockResolvedValueOnce({ id: 'user-1' });
    createVerificationTokenMock.mockResolvedValueOnce('token');

    const input: AgentAssistInput = {
      skill: 'auth',
      messages: [{ role: 'user', content: 'forgot password' }],
      context: {
        surface: 'auth-login',
        locale: 'en-IN',
        email: 'user@example.com',
      },
      allowedActions: ['auth.forgot_password'],
      requestedAction: 'auth.forgot_password',
      executeRequestedAction: true,
    };
    const response = await service.assist(input, { requestId: 'req-1' });

    expect(createVerificationTokenMock).toHaveBeenCalledWith(
      'user-1',
      'PASSWORD_RESET',
    );
    expect(response.executedAction?.executed).toBe(true);
    expect(response.platformEndpointUsed).toBe('http://localhost:8100');
    expect(response.platformAttemptCount).toBe(1);
  });

  it('rejects authenticated skills without a bearer token', async () => {
    const service = createService();

    await expect(
      service.assist(
        {
          skill: 'inbox',
          messages: [{ role: 'user', content: 'summarize this thread' }],
          context: { surface: 'inbox', locale: 'en-IN' },
          allowedActions: ['inbox.summarize_thread'],
          executeRequestedAction: false,
        },
        { requestId: 'req-unauth', headers: {} },
      ),
    ).rejects.toThrow('requires authentication token');
  });

  it('rejects authenticated assist when AI credits are exhausted', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can summarize this thread.',
        intent: 'thread_summary',
        confidence: 0.95,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    (billingService.consumeAiCredits as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      planCode: 'FREE',
      monthlyLimit: 50,
      usedCredits: 50,
      remainingCredits: 0,
      periodStart: '2026-02-01',
      requestedCredits: 1,
      lastConsumedAtIso: null,
    });

    await expect(
      service.assist(
        {
          skill: 'inbox',
          messages: [{ role: 'user', content: 'summarize thread' }],
          context: { surface: 'inbox', locale: 'en-IN' },
          allowedActions: ['inbox.summarize_thread'],
          executeRequestedAction: false,
        },
        {
          requestId: 'req-no-credits',
          headers: { authorization: 'Bearer token' },
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns service unavailable when platform is down', async () => {
    const service = createService();
    mockedAxios.post.mockRejectedValueOnce(new Error('connection failed'));
    mockedAxios.post.mockRejectedValueOnce(new Error('connection failed'));

    await expect(
      service.assist({
        skill: 'auth',
        messages: [{ role: 'user', content: 'help me login' }],
        context: { surface: 'auth-login', locale: 'en-IN' },
        allowedActions: ['auth.open_login'],
        executeRequestedAction: false,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects requested action when not suggested by agent output', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'Open registration flow.',
        intent: 'signup_help',
        confidence: 0.82,
        suggestedActions: [
          { name: 'auth.open_register', label: 'Open registration flow' },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);

    await expect(
      service.assist({
        skill: 'auth',
        messages: [{ role: 'user', content: 'forgot password' }],
        context: {
          surface: 'auth-login',
          locale: 'en-IN',
          email: 'user@example.com',
        },
        allowedActions: ['auth.forgot_password', 'auth.open_register'],
        requestedAction: 'auth.forgot_password',
        executeRequestedAction: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports health as down when platform probe fails', async () => {
    const service = createService();
    mockedAxios.get.mockRejectedValueOnce(new Error('health check failed'));

    const health = await service.getPlatformHealth();
    expect(health.reachable).toBe(false);
    expect(health.status).toBe('down');
    expect(health.probedServiceUrls).toEqual(['http://localhost:8100']);
    expect(health.configuredServiceUrls).toEqual(['http://localhost:8100']);
    expect(health.skillStats).toEqual([]);
    expect(health.endpointStats).toEqual([
      expect.objectContaining({
        endpointUrl: 'http://localhost:8100',
        successCount: 0,
        failureCount: 0,
      }),
    ]);
  });

  it('persists health snapshot rows when platform health is queried', async () => {
    const service = createService();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
      },
    } as any);

    const health = await service.getPlatformHealth();

    expect(saveHealthSampleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        reachable: true,
        serviceUrl: health.serviceUrl,
        checkedAt: expect.any(Date),
      }),
    );
  });

  it('returns persisted platform health history with window filtering', async () => {
    const service = createService();
    findHealthSamplesMock.mockResolvedValueOnce([
      {
        status: 'warn',
        reachable: true,
        serviceUrl: 'http://primary-agent.local',
        configuredServiceUrls: [
          'http://primary-agent.local',
          'http://secondary-agent.local',
        ],
        probedServiceUrls: ['http://primary-agent.local'],
        endpointStats: [
          {
            endpointUrl: 'http://primary-agent.local',
            successCount: 10,
            failureCount: 2,
            lastSuccessAtIso: '2026-02-16T00:00:00.000Z',
          },
        ],
        skillStats: [
          {
            skill: 'auth',
            totalRequests: 15,
            failedRequests: 1,
            timeoutFailures: 0,
            avgLatencyMs: 18,
            lastLatencyMs: 12,
            errorRatePercent: 6.66,
          },
        ],
        checkedAt: new Date('2026-02-16T00:00:00.000Z'),
        requestCount: 15,
        errorCount: 1,
        timeoutErrorCount: 0,
        errorRatePercent: 6.66,
        avgLatencyMs: 18,
        latencyWarnMs: 1500,
        errorRateWarnPercent: 5,
        alertingState: 'warn',
      },
    ]);

    const history = await service.getPlatformHealthHistory({
      limit: 20,
      windowHours: 48,
    });

    expect(findHealthSamplesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        order: { checkedAt: 'DESC' },
        where: expect.objectContaining({
          checkedAt: expect.any(Object),
        }),
      }),
    );
    expect(history).toEqual([
      expect.objectContaining({
        status: 'warn',
        requestCount: 15,
        alertingState: 'warn',
      }),
    ]);
  });

  it('purges persisted health samples using retention days', async () => {
    const service = createService();
    deleteHealthSamplesMock.mockResolvedValueOnce({ affected: 6 });

    const result = await service.purgePlatformHealthSampleRetentionData({
      retentionDays: 45,
      actorUserId: 'admin-1',
    });

    expect(deleteHealthSamplesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        checkedAt: expect.any(Object),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        deletedSamples: 6,
        retentionDays: 45,
        executedAtIso: expect.any(String),
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'agent_platform_health_sample_retention_purged',
      }),
    );
  });

  it('exports persisted health sample data as JSON payload', async () => {
    const service = createService();
    findHealthSamplesMock.mockResolvedValueOnce([
      {
        status: 'ok',
        reachable: true,
        serviceUrl: 'http://localhost:8100',
        configuredServiceUrls: ['http://localhost:8100'],
        probedServiceUrls: ['http://localhost:8100'],
        endpointStats: [],
        skillStats: [],
        checkedAt: new Date('2026-02-16T00:00:00.000Z'),
        requestCount: 4,
        errorCount: 0,
        timeoutErrorCount: 0,
        errorRatePercent: 0,
        avgLatencyMs: 12,
        latencyWarnMs: 1500,
        errorRateWarnPercent: 5,
        alertingState: 'healthy',
      },
    ]);

    const result = await service.exportPlatformHealthSampleData({
      limit: 25,
      windowHours: 24,
      actorUserId: 'admin-1',
    });
    const payload = JSON.parse(result.dataJson) as {
      sampleCount: number;
      samples: Array<{ status: string }>;
      retentionPolicy: { retentionDays: number };
    };

    expect(payload.sampleCount).toBe(1);
    expect(payload.samples[0]?.status).toBe('ok');
    expect(payload.retentionPolicy.retentionDays).toBe(30);
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'agent_platform_health_sample_data_export_requested',
      }),
    );
  });

  it('returns aggregated health trend summary for rolling window', async () => {
    const service = createService();
    findHealthSamplesMock.mockResolvedValueOnce([
      {
        alertingState: 'healthy',
        errorRatePercent: 1,
        avgLatencyMs: 80,
        checkedAt: new Date('2026-02-16T02:00:00.000Z'),
      },
      {
        alertingState: 'warn',
        errorRatePercent: 8,
        avgLatencyMs: 240,
        checkedAt: new Date('2026-02-16T01:00:00.000Z'),
      },
      {
        alertingState: 'critical',
        errorRatePercent: 18,
        avgLatencyMs: 640,
        checkedAt: new Date('2026-02-16T00:00:00.000Z'),
      },
    ]);

    const summary = await service.getPlatformHealthTrendSummary({
      windowHours: 24,
    });

    expect(findHealthSamplesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5000,
        order: { checkedAt: 'DESC' },
      }),
    );
    expect(summary).toEqual(
      expect.objectContaining({
        windowHours: 24,
        sampleCount: 3,
        healthyCount: 1,
        warnCount: 1,
        criticalCount: 1,
        avgErrorRatePercent: 9,
        peakErrorRatePercent: 18,
        avgLatencyMs: 320,
        peakLatencyMs: 640,
        latestCheckedAtIso: '2026-02-16T02:00:00.000Z',
      }),
    );
  });

  it('returns bucketed health trend series for dashboard plotting', async () => {
    const service = createService();
    findHealthSamplesMock.mockResolvedValueOnce([
      {
        alertingState: 'healthy',
        errorRatePercent: 1,
        avgLatencyMs: 100,
        checkedAt: new Date('2026-02-16T00:05:00.000Z'),
      },
      {
        alertingState: 'warn',
        errorRatePercent: 7,
        avgLatencyMs: 210,
        checkedAt: new Date('2026-02-16T00:20:00.000Z'),
      },
      {
        alertingState: 'critical',
        errorRatePercent: 16,
        avgLatencyMs: 480,
        checkedAt: new Date('2026-02-16T00:38:00.000Z'),
      },
    ]);

    const series = await service.getPlatformHealthTrendSeries({
      windowHours: 24,
      bucketMinutes: 30,
    });

    expect(findHealthSamplesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { checkedAt: 'ASC' },
        take: 5000,
      }),
    );
    expect(series.length).toBeGreaterThan(0);
    const firstNonEmptyBucket = series.find((point) => point.sampleCount > 0);
    expect(firstNonEmptyBucket).toEqual(
      expect.objectContaining({
        sampleCount: expect.any(Number),
        avgErrorRatePercent: expect.any(Number),
        avgLatencyMs: expect.any(Number),
      }),
    );
  });

  it('returns incident stats based on warn and critical samples only', async () => {
    const service = createService();
    findHealthSamplesMock.mockResolvedValueOnce([
      {
        alertingState: 'healthy',
        checkedAt: new Date('2026-02-16T03:00:00.000Z'),
      },
      {
        alertingState: 'warn',
        checkedAt: new Date('2026-02-16T02:00:00.000Z'),
      },
      {
        alertingState: 'critical',
        checkedAt: new Date('2026-02-16T01:00:00.000Z'),
      },
    ]);

    const stats = await service.getPlatformHealthIncidentStats({
      windowHours: 24,
    });

    expect(stats).toEqual(
      expect.objectContaining({
        windowHours: 24,
        totalCount: 2,
        warnCount: 1,
        criticalCount: 1,
        lastIncidentAtIso: '2026-02-16T02:00:00.000Z',
      }),
    );
  });

  it('returns incident series with warn and critical bucket counts', async () => {
    const service = createService();
    findHealthSamplesMock.mockResolvedValueOnce([
      {
        alertingState: 'warn',
        checkedAt: new Date('2026-02-16T00:05:00.000Z'),
      },
      {
        alertingState: 'critical',
        checkedAt: new Date('2026-02-16T00:08:00.000Z'),
      },
      {
        alertingState: 'healthy',
        checkedAt: new Date('2026-02-16T00:12:00.000Z'),
      },
      {
        alertingState: 'warn',
        checkedAt: new Date('2026-02-16T00:37:00.000Z'),
      },
    ]);

    const series = await service.getPlatformHealthIncidentSeries({
      windowHours: 24,
      bucketMinutes: 30,
    });

    expect(series.length).toBeGreaterThan(0);
    expect(
      series.some((point) => point.warnCount > 0 || point.criticalCount > 0),
    ).toBe(true);
    const firstIncidentBucket = series.find((point) => point.totalCount > 0);
    expect(firstIncidentBucket).toEqual(
      expect.objectContaining({
        totalCount: expect.any(Number),
        warnCount: expect.any(Number),
        criticalCount: expect.any(Number),
      }),
    );
  });

  it('exports incident analytics payload with stats and series', async () => {
    const service = createService();
    findHealthSamplesMock
      .mockResolvedValueOnce([
        {
          alertingState: 'warn',
          checkedAt: new Date('2026-02-16T00:05:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          alertingState: 'warn',
          checkedAt: new Date('2026-02-16T00:05:00.000Z'),
        },
      ]);

    const result = await service.exportPlatformHealthIncidentData({
      windowHours: 24,
      bucketMinutes: 30,
      actorUserId: 'admin-1',
    });
    const payload = JSON.parse(result.dataJson) as {
      stats: { totalCount: number };
      series: Array<{ totalCount: number }>;
    };

    expect(payload.stats.totalCount).toBe(1);
    expect(payload.series.length).toBeGreaterThan(0);
    expect(payload.series.some((point) => point.totalCount > 0)).toBe(true);
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'agent_platform_health_incident_data_export_requested',
      }),
    );
  });

  it('hydrates persisted runtime stats from database on module init', async () => {
    process.env.AI_AGENT_GATEWAY_USE_REDIS = 'false';
    findEndpointRuntimeStatsMock.mockResolvedValueOnce([
      {
        endpointUrl: 'http://primary-agent.local',
        successCount: 7,
        failureCount: 2,
        lastSuccessAt: new Date('2026-02-15T10:00:00.000Z'),
        lastFailureAt: new Date('2026-02-15T09:00:00.000Z'),
      },
    ]);
    findSkillRuntimeStatsMock.mockResolvedValueOnce([
      {
        skill: 'inbox',
        totalRequests: 11,
        failedRequests: 3,
        timeoutFailures: 1,
        totalLatencyMs: 910,
        lastLatencyMs: 72,
        lastErrorAt: new Date('2026-02-15T09:05:00.000Z'),
      },
    ]);
    const service = createService();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
      },
    } as any);

    await service.onModuleInit();
    const health = await service.getPlatformHealth();

    expect(health.endpointStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpointUrl: 'http://primary-agent.local',
          successCount: 7,
          failureCount: 2,
        }),
      ]),
    );
    expect(health.skillStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skill: 'inbox',
          totalRequests: 11,
          failedRequests: 3,
          timeoutFailures: 1,
          lastLatencyMs: 72,
        }),
      ]),
    );
    delete process.env.AI_AGENT_GATEWAY_USE_REDIS;
  });

  it('falls back to secondary platform endpoint when primary call fails', async () => {
    process.env.AI_AGENT_PLATFORM_URLS =
      'http://primary-agent.local,http://secondary-agent.local';
    const service = createService();
    mockedAxios.post.mockRejectedValueOnce(new Error('primary down'));
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'Use forgot password.',
        intent: 'forgot_password',
        confidence: 0.9,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);

    const response = await service.assist({
      skill: 'auth',
      messages: [{ role: 'user', content: 'help me login' }],
      context: { surface: 'auth-login', locale: 'en-IN' },
      allowedActions: ['auth.open_login'],
      executeRequestedAction: false,
    });

    expect(response.assistantText).toBe('Use forgot password.');
    expect(response.platformEndpointUsed).toBe('http://secondary-agent.local');
    expect(response.platformAttemptCount).toBe(2);
    expect(mockedAxios.post.mock.calls[0]?.[0]).toContain(
      'http://primary-agent.local',
    );
    expect(mockedAxios.post.mock.calls[1]?.[0]).toContain(
      'http://secondary-agent.local',
    );
  });

  it('reports endpoint runtime stats after assist failover attempts', async () => {
    process.env.AI_AGENT_PLATFORM_URLS =
      'http://primary-agent.local,http://secondary-agent.local';
    const service = createService();
    mockedAxios.post.mockRejectedValueOnce(new Error('primary down'));
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'Use forgot password.',
        intent: 'forgot_password',
        confidence: 0.9,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
      },
    } as any);

    await service.assist({
      skill: 'auth',
      messages: [{ role: 'user', content: 'help me login' }],
      context: { surface: 'auth-login', locale: 'en-IN' },
      allowedActions: ['auth.open_login'],
      executeRequestedAction: false,
    });

    const health = await service.getPlatformHealth();

    expect(
      health.endpointStats.find(
        (entry: { endpointUrl: string }) =>
          entry.endpointUrl === 'http://primary-agent.local',
      ),
    ).toEqual(
      expect.objectContaining({
        successCount: 0,
        failureCount: 1,
        lastFailureAtIso: expect.any(String),
      }),
    );
    expect(
      health.endpointStats.find(
        (entry: { endpointUrl: string }) =>
          entry.endpointUrl === 'http://secondary-agent.local',
      ),
    ).toEqual(
      expect.objectContaining({
        successCount: 1,
        failureCount: 0,
        lastSuccessAtIso: expect.any(String),
      }),
    );
  });

  it('resets all endpoint runtime stats when no endpointUrl is provided', async () => {
    process.env.AI_AGENT_PLATFORM_URLS =
      'http://primary-agent.local,http://secondary-agent.local';
    const service = createService();
    mockedAxios.post
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({
        data: {
          version: 'v1',
          skill: 'auth',
          assistantText: 'Use forgot password.',
          intent: 'forgot_password',
          confidence: 0.9,
          suggestedActions: [],
          uiHints: {},
          safetyFlags: [],
        },
      } as any);
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'ok',
      },
    } as any);

    await service.assist({
      skill: 'auth',
      messages: [{ role: 'user', content: 'help me login' }],
      context: { surface: 'auth-login', locale: 'en-IN' },
      allowedActions: ['auth.open_login'],
      executeRequestedAction: false,
    });
    const beforeReset = await service.getPlatformHealth();
    const primaryBefore = beforeReset.endpointStats.find(
      (entry: { endpointUrl: string }) =>
        entry.endpointUrl === 'http://primary-agent.local',
    );
    expect(primaryBefore).toEqual(
      expect.objectContaining({
        failureCount: 1,
      }),
    );

    const resetResult = await service.resetPlatformRuntimeStats({
      actorUserId: 'admin-1',
    });
    const afterReset = await service.getPlatformHealth();
    const primaryAfter = afterReset.endpointStats.find(
      (entry: { endpointUrl: string }) =>
        entry.endpointUrl === 'http://primary-agent.local',
    );

    expect(resetResult).toEqual(
      expect.objectContaining({
        clearedEndpoints: 2,
        scopedEndpointUrl: null,
      }),
    );
    expect(primaryAfter).toEqual(
      expect.objectContaining({
        successCount: 0,
        failureCount: 0,
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'agent_platform_runtime_stats_reset',
      }),
    );
  });

  it('resets one endpoint runtime stat when endpointUrl is provided', async () => {
    process.env.AI_AGENT_PLATFORM_URLS =
      'http://primary-agent.local,http://secondary-agent.local';
    const service = createService();
    mockedAxios.post
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({
        data: {
          version: 'v1',
          skill: 'auth',
          assistantText: 'Use forgot password.',
          intent: 'forgot_password',
          confidence: 0.9,
          suggestedActions: [],
          uiHints: {},
          safetyFlags: [],
        },
      } as any);
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'ok',
      },
    } as any);

    await service.assist({
      skill: 'auth',
      messages: [{ role: 'user', content: 'help me login' }],
      context: { surface: 'auth-login', locale: 'en-IN' },
      allowedActions: ['auth.open_login'],
      executeRequestedAction: false,
    });

    const resetResult = await service.resetPlatformRuntimeStats({
      endpointUrl: 'http://primary-agent.local',
    });
    const health = await service.getPlatformHealth();
    const primaryStats = health.endpointStats.find(
      (entry: { endpointUrl: string }) =>
        entry.endpointUrl === 'http://primary-agent.local',
    );
    const secondaryStats = health.endpointStats.find(
      (entry: { endpointUrl: string }) =>
        entry.endpointUrl === 'http://secondary-agent.local',
    );

    expect(resetResult).toEqual(
      expect.objectContaining({
        clearedEndpoints: 1,
        scopedEndpointUrl: 'http://primary-agent.local',
      }),
    );
    expect(primaryStats).toEqual(
      expect.objectContaining({
        successCount: 0,
        failureCount: 0,
      }),
    );
    expect(secondaryStats).toEqual(
      expect.objectContaining({
        successCount: 1,
        failureCount: 0,
      }),
    );
  });

  it('rotates platform endpoint order when load balancing is enabled', async () => {
    process.env.AI_AGENT_PLATFORM_URLS =
      'http://primary-agent.local,http://secondary-agent.local,http://tertiary-agent.local';
    process.env.AI_AGENT_PLATFORM_LOAD_BALANCE_ENABLED = 'true';
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'Load-balanced response.',
        intent: 'auth_help',
        confidence: 0.81,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    const requestId = 'req-load-balance-1';
    const configuredUrls = [
      'http://primary-agent.local',
      'http://secondary-agent.local',
      'http://tertiary-agent.local',
    ];
    const digest = createHash('sha1')
      .update(requestId)
      .digest('hex')
      .slice(0, 8);
    const expectedStartIndex = parseInt(digest, 16) % configuredUrls.length;
    const expectedUrl = configuredUrls[expectedStartIndex];

    await service.assist(
      {
        skill: 'auth',
        messages: [{ role: 'user', content: 'help me login' }],
        context: { surface: 'auth-login', locale: 'en-IN' },
        allowedActions: ['auth.open_login'],
        executeRequestedAction: false,
      },
      {
        requestId,
      },
    );

    expect(mockedAxios.post.mock.calls[0]?.[0]).toContain(expectedUrl);
  });

  it('falls back to secondary health probe endpoint when primary is down', async () => {
    process.env.AI_AGENT_PLATFORM_URLS =
      'http://primary-agent.local,http://secondary-agent.local';
    const service = createService();
    mockedAxios.get.mockRejectedValueOnce(new Error('health check failed'));
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
      },
    } as any);

    const health = await service.getPlatformHealth();

    expect(health.reachable).toBe(true);
    expect(health.status).toBe('ok');
    expect(health.serviceUrl).toBe('http://secondary-agent.local');
    expect(health.probedServiceUrls).toEqual([
      'http://primary-agent.local',
      'http://secondary-agent.local',
    ]);
    expect(health.configuredServiceUrls).toEqual([
      'http://primary-agent.local',
      'http://secondary-agent.local',
    ]);
  });

  it('normalizes and de-duplicates configured platform endpoint list', async () => {
    process.env.AI_AGENT_PLATFORM_URLS =
      'http://primary-agent.local/, http://primary-agent.local, http://secondary-agent.local/';
    const service = createService();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
      },
    } as any);

    const health = await service.getPlatformHealth();

    expect(health.reachable).toBe(true);
    expect(health.configuredServiceUrls).toEqual([
      'http://primary-agent.local',
      'http://secondary-agent.local',
    ]);
    expect(health.probedServiceUrls).toEqual(['http://primary-agent.local']);
  });

  it('includes per-skill runtime stats in platform health snapshot', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'Use forgot password.',
        intent: 'forgot_password',
        confidence: 0.9,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
      },
    } as any);

    await service.assist({
      skill: 'auth',
      messages: [{ role: 'user', content: 'help me login' }],
      context: { surface: 'auth-login', locale: 'en-IN' },
      allowedActions: ['auth.open_login'],
      executeRequestedAction: false,
    });

    const health = await service.getPlatformHealth();

    expect(health.skillStats).toEqual([
      expect.objectContaining({
        skill: 'auth',
        totalRequests: 1,
        failedRequests: 0,
        timeoutFailures: 0,
        lastLatencyMs: expect.any(Number),
        avgLatencyMs: expect.any(Number),
        errorRatePercent: 0,
      }),
    ]);
  });

  it('resets one skill runtime stat when skill is provided', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'Use forgot password.',
        intent: 'forgot_password',
        confidence: 0.9,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'ok',
      },
    } as any);

    await service.assist({
      skill: 'auth',
      messages: [{ role: 'user', content: 'help me login' }],
      context: { surface: 'auth-login', locale: 'en-IN' },
      allowedActions: ['auth.open_login'],
      executeRequestedAction: false,
    });
    const beforeReset = await service.getPlatformHealth();
    expect(
      beforeReset.skillStats.find(
        (entry: { skill: string }) => entry.skill === 'auth',
      ),
    ).toEqual(
      expect.objectContaining({
        totalRequests: 1,
      }),
    );

    const resetResult = await service.resetSkillRuntimeStats({
      skill: 'auth',
      actorUserId: 'admin-1',
    });
    const afterReset = await service.getPlatformHealth();
    expect(
      afterReset.skillStats.find(
        (entry: { skill: string }) => entry.skill === 'auth',
      ),
    ).toBeUndefined();
    expect(resetResult).toEqual(
      expect.objectContaining({
        clearedSkills: 1,
        scopedSkill: 'auth',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'agent_platform_skill_runtime_stats_reset',
      }),
    );
  });

  it('persists endpoint and skill runtime stats during assist requests', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'auth',
        assistantText: 'Use forgot password.',
        intent: 'forgot_password',
        confidence: 0.9,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);

    await service.assist({
      skill: 'auth',
      messages: [{ role: 'user', content: 'help me login' }],
      context: { surface: 'auth-login', locale: 'en-IN' },
      allowedActions: ['auth.open_login'],
      executeRequestedAction: false,
    });

    expect(upsertEndpointRuntimeStatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointUrl: 'http://localhost:8100',
        successCount: 1,
        failureCount: 0,
      }),
      ['endpointUrl'],
    );
    expect(upsertSkillRuntimeStatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'auth',
        totalRequests: 1,
        failedRequests: 0,
        timeoutFailures: 0,
      }),
      ['skill'],
    );
  });

  it('executes inbox summary action when suggested and requested', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can summarize this thread.',
        intent: 'thread_summary',
        confidence: 0.95,
        suggestedActions: [
          {
            name: 'inbox.summarize_thread',
            label: 'Summarize thread',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findExternalMessagesMock
      .mockResolvedValueOnce([
        {
          subject: 'Q1 plan',
          from: 'alice@example.com',
          snippet: 'Please review the quarterly plan before Friday.',
        },
        {
          subject: 'Q1 plan',
          from: 'you@example.com',
          snippet: 'Acknowledged. I will review and revert with comments.',
        },
      ])
      .mockResolvedValueOnce([
        {
          subject: 'Q1 plan',
          from: 'alice@example.com',
          snippet: 'Please review the quarterly plan before Friday.',
        },
        {
          subject: 'Q1 plan',
          from: 'you@example.com',
          snippet: 'Acknowledged. I will review and revert with comments.',
        },
      ]);

    const input: AgentAssistInput = {
      skill: 'inbox',
      messages: [{ role: 'user', content: 'Summarize this thread for me.' }],
      context: {
        surface: 'inbox',
        locale: 'en-IN',
        metadataJson: JSON.stringify({ threadId: 'thread-123' }),
      },
      allowedActions: ['inbox.summarize_thread'],
      requestedAction: 'inbox.summarize_thread',
      executeRequestedAction: true,
    };

    const response = await service.assist(input, {
      requestId: 'req-summary-1',
      headers: { authorization: 'Bearer token-1' },
    });

    expect(findExternalMessagesMock).toHaveBeenCalled();
    expect(billingService.consumeAiCredits).toHaveBeenCalledWith({
      userId: 'user-1',
      credits: 1,
      requestId: 'req-summary-1',
    });
    expect(response.aiCreditsMonthlyLimit).toBe(500);
    expect(response.aiCreditsUsed).toBe(10);
    expect(response.aiCreditsRemaining).toBe(490);
    expect(response.executedAction?.executed).toBe(true);
    expect(response.executedAction?.message).toContain('summary');
  });

  it('executes inbox classify action when suggested and requested', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can classify this thread.',
        intent: 'thread_classification',
        confidence: 0.89,
        suggestedActions: [
          {
            name: 'inbox.classify_thread',
            label: 'Classify thread',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findExternalMessagesMock.mockResolvedValue([
      {
        subject: 'Critical outage impact',
        from: 'ops@example.com',
        snippet: 'Urgent blocker impacting customer delivery.',
      },
    ]);

    const response = await service.assist(
      {
        skill: 'inbox',
        messages: [{ role: 'user', content: 'Classify this thread.' }],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-classify-1' }),
        },
        allowedActions: ['inbox.classify_thread'],
        requestedAction: 'inbox.classify_thread',
        executeRequestedAction: true,
      },
      {
        requestId: 'req-classify-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    expect(response.executedAction?.executed).toBe(true);
    expect(response.executedAction?.message).toContain(
      'classified as URGENT_ISSUE',
    );
    expect(saveAgentActionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbox.classify_thread',
        executed: true,
      }),
    );
  });

  it('executes inbox prioritize action when suggested and requested', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can prioritize this thread.',
        intent: 'thread_priority',
        confidence: 0.9,
        suggestedActions: [
          {
            name: 'inbox.prioritize_thread',
            label: 'Prioritize thread',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findExternalMessagesMock.mockResolvedValue([
      {
        subject: 'ASAP renewal approval',
        from: 'ceo@example.com',
        snippet: 'Urgent: need this renewal decision today?',
      },
    ]);

    const response = await service.assist(
      {
        skill: 'inbox',
        messages: [{ role: 'user', content: 'Prioritize this thread.' }],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-priority-1' }),
        },
        allowedActions: ['inbox.prioritize_thread'],
        requestedAction: 'inbox.prioritize_thread',
        executeRequestedAction: true,
      },
      {
        requestId: 'req-priority-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    expect(response.executedAction?.executed).toBe(true);
    expect(response.executedAction?.message).toContain('Priority set to HIGH');
    expect(saveAgentActionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbox.prioritize_thread',
        executed: true,
      }),
    );
  });

  it('executes inbox extract-action-items action when suggested and requested', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can extract action items from this thread.',
        intent: 'thread_action_items',
        confidence: 0.88,
        suggestedActions: [
          {
            name: 'inbox.extract_action_items',
            label: 'Extract action items',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findExternalMessagesMock.mockResolvedValue([
      {
        subject: 'Customer onboarding follow-up',
        from: 'ops@example.com',
        snippet:
          'Please send the onboarding checklist by tomorrow. Need to confirm owner for training session.',
      },
    ]);

    const response = await service.assist(
      {
        skill: 'inbox',
        messages: [{ role: 'user', content: 'Extract action items.' }],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-actions-1' }),
        },
        allowedActions: ['inbox.extract_action_items'],
        requestedAction: 'inbox.extract_action_items',
        executeRequestedAction: true,
      },
      {
        requestId: 'req-action-items-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    expect(response.executedAction?.executed).toBe(true);
    expect(response.executedAction?.message).toContain(
      'Extracted 2 action item(s)',
    );
    expect(saveAgentActionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbox.extract_action_items',
        executed: true,
      }),
    );
  });

  it('executes inbox open-thread action when suggested and requested', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can open this thread.',
        intent: 'thread_open',
        confidence: 0.9,
        suggestedActions: [
          {
            name: 'inbox.open_thread',
            label: 'Open thread',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findExternalMessagesMock.mockResolvedValue([
      {
        threadId: 'thread-open-1',
        subject: 'Quarterly planning',
        from: 'ops@example.com',
        snippet: 'Sharing the timeline and owners.',
      },
    ]);

    const response = await service.assist(
      {
        skill: 'inbox',
        messages: [{ role: 'user', content: 'Open this thread.' }],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-open-1' }),
        },
        allowedActions: ['inbox.open_thread'],
        requestedAction: 'inbox.open_thread',
        executeRequestedAction: true,
      },
      {
        requestId: 'req-open-thread-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    expect(response.executedAction?.executed).toBe(true);
    expect(response.executedAction?.message).toContain(
      'Opened thread "Quarterly planning"',
    );
    expect(saveAgentActionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbox.open_thread',
        executed: true,
      }),
    );
  });

  it('adds runtime memory context for authenticated inbox requests', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'Acknowledged.',
        intent: 'thread_summary',
        confidence: 0.93,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findOneMock.mockResolvedValueOnce({
      id: 'user-1',
      name: 'Aman Sharma',
      email: 'aman@mailzen.com',
      activeWorkspaceId: 'workspace-1',
    });
    findExternalMessagesMock.mockResolvedValueOnce([
      {
        subject: 'Quarterly review',
        snippet: 'Can we close the planning doc by Friday?',
      },
      {
        subject: 'Quarterly review follow-up',
        snippet: 'Please share risk register updates and owners.',
      },
    ]);
    findWorkspaceMemberMock.mockResolvedValueOnce({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'ADMIN',
      status: 'active',
    });

    await service.assist(
      {
        skill: 'inbox',
        messages: [{ role: 'user', content: 'Summarize this thread quickly.' }],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-5' }),
        },
        allowedActions: ['inbox.summarize_thread'],
        executeRequestedAction: false,
      },
      {
        requestId: 'req-memory-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    const payload = mockedAxios.post.mock.calls[0]?.[1] as {
      context: {
        metadata: Record<string, string>;
      };
    };
    expect(payload.context.metadata.threadSummary).toContain(
      'Quarterly review',
    );
    expect(payload.context.metadata.userStyleProfile).toContain('avgWords=');
    expect(payload.context.metadata.workspacePolicy).toContain(
      'mode=elevated-review',
    );
    expect(payload.context.metadata.userProfileName).toBe('Aman Sharma');
  });

  it('reuses thread memory context from cache for repeated assist calls', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValue({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'Acknowledged.',
        intent: 'thread_summary',
        confidence: 0.93,
        suggestedActions: [],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findOneMock.mockResolvedValue({
      id: 'user-1',
      name: 'Aman Sharma',
      email: 'aman@mailzen.com',
      activeWorkspaceId: null,
    });
    findExternalMessagesMock.mockResolvedValue([
      {
        subject: 'Deal review',
        snippet: 'Please confirm final pricing approval by EOD.',
      },
    ]);

    await service.assist(
      {
        skill: 'inbox',
        messages: [{ role: 'user', content: 'Summarize deal thread.' }],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-cache-1' }),
        },
        allowedActions: ['inbox.summarize_thread'],
        executeRequestedAction: false,
      },
      {
        requestId: 'req-cache-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    await service.assist(
      {
        skill: 'inbox',
        messages: [{ role: 'user', content: 'Summarize deal thread.' }],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-cache-1' }),
        },
        allowedActions: ['inbox.summarize_thread'],
        executeRequestedAction: false,
      },
      {
        requestId: 'req-cache-2',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    expect(findExternalMessagesMock).toHaveBeenCalledTimes(1);
  });

  it('rejects risky inbox actions without approval token', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can draft a reply.',
        intent: 'reply_draft',
        confidence: 0.88,
        suggestedActions: [
          {
            name: 'inbox.compose_reply_draft',
            label: 'Create draft reply',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);

    await expect(
      service.assist(
        {
          skill: 'inbox',
          messages: [
            { role: 'user', content: 'Draft a response for this thread' },
          ],
          context: {
            surface: 'inbox',
            locale: 'en-IN',
            metadataJson: JSON.stringify({ threadId: 'thread-999' }),
          },
          allowedActions: ['inbox.compose_reply_draft'],
          requestedAction: 'inbox.compose_reply_draft',
          executeRequestedAction: true,
        },
        {
          requestId: 'req-draft-deny-1',
          headers: { authorization: 'Bearer token-1' },
        },
      ),
    ).rejects.toThrow('requires human approval token');
  });

  it('executes inbox draft action when suggested and requested', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can draft a reply.',
        intent: 'reply_draft',
        confidence: 0.88,
        suggestedActions: [
          {
            name: 'inbox.compose_reply_draft',
            label: 'Create draft reply',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can draft a reply.',
        intent: 'reply_draft',
        confidence: 0.88,
        suggestedActions: [
          {
            name: 'inbox.compose_reply_draft',
            label: 'Create draft reply',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    findExternalMessagesMock
      .mockResolvedValueOnce([
        {
          subject: 'Vendor onboarding',
          from: 'ops@example.com',
          snippet: 'Can you confirm the onboarding checklist timeline?',
        },
      ])
      .mockResolvedValueOnce([
        {
          subject: 'Vendor onboarding',
          from: 'ops@example.com',
          snippet: 'Can you confirm the onboarding checklist timeline?',
        },
      ]);

    const approvalResponse = await service.assist(
      {
        skill: 'inbox',
        messages: [
          { role: 'user', content: 'Draft a response for this thread' },
        ],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-999' }),
        },
        allowedActions: ['inbox.compose_reply_draft'],
        executeRequestedAction: false,
      },
      {
        requestId: 'req-draft-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    const approvalToken =
      approvalResponse.suggestedActions[0]?.approvalToken || '';
    expect(approvalResponse.suggestedActions[0]?.requiresApproval).toBe(true);

    const response = await service.assist(
      {
        skill: 'inbox',
        messages: [
          { role: 'user', content: 'Draft a response for this thread' },
        ],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({ threadId: 'thread-999' }),
        },
        allowedActions: ['inbox.compose_reply_draft'],
        requestedAction: 'inbox.compose_reply_draft',
        requestedActionApprovalToken: approvalToken,
        executeRequestedAction: true,
      },
      {
        requestId: 'req-draft-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    expect(response.executedAction?.executed).toBe(true);
    expect(response.executedAction?.message).toContain('Draft reply');
    expect(response.executedAction?.message).toContain('Vendor onboarding');
    expect(saveAgentActionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'inbox',
        action: 'inbox.compose_reply_draft',
        executed: true,
        approvalRequired: true,
      }),
    );
  });

  it('schedules follow-up reminder action when suggested and requested', async () => {
    const service = createService();
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can schedule a follow-up reminder.',
        intent: 'followup',
        confidence: 0.9,
        suggestedActions: [
          {
            name: 'inbox.schedule_followup',
            label: 'Schedule follow-up',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        version: 'v1',
        skill: 'inbox',
        assistantText: 'I can schedule a follow-up reminder.',
        intent: 'followup',
        confidence: 0.9,
        suggestedActions: [
          {
            name: 'inbox.schedule_followup',
            label: 'Schedule follow-up',
            payload: {},
          },
        ],
        uiHints: {},
        safetyFlags: [],
      },
    } as any);
    createNotificationMock.mockResolvedValueOnce({
      id: 'notif-followup-1',
    });

    const approvalResponse = await service.assist(
      {
        skill: 'inbox',
        messages: [
          { role: 'user', content: 'Remind me to follow up tomorrow.' },
        ],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({
            threadId: 'thread-111',
            providerId: 'provider-11',
            workspaceId: 'workspace-11',
            followupAtIso: '2026-02-16T10:00:00.000Z',
          }),
        },
        allowedActions: ['inbox.schedule_followup'],
        executeRequestedAction: false,
      },
      {
        requestId: 'req-followup-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    const approvalToken =
      approvalResponse.suggestedActions[0]?.approvalToken || '';
    expect(approvalResponse.suggestedActions[0]?.requiresApproval).toBe(true);

    const response = await service.assist(
      {
        skill: 'inbox',
        messages: [
          { role: 'user', content: 'Remind me to follow up tomorrow.' },
        ],
        context: {
          surface: 'inbox',
          locale: 'en-IN',
          metadataJson: JSON.stringify({
            threadId: 'thread-111',
            providerId: 'provider-11',
            workspaceId: 'workspace-11',
            followupAtIso: '2026-02-16T10:00:00.000Z',
          }),
        },
        allowedActions: ['inbox.schedule_followup'],
        requestedAction: 'inbox.schedule_followup',
        requestedActionApprovalToken: approvalToken,
        executeRequestedAction: true,
      },
      {
        requestId: 'req-followup-1',
        headers: { authorization: 'Bearer token-1' },
      },
    );

    const notificationCalls = createNotificationMock.mock.calls as Array<
      [
        {
          userId: string;
          type: string;
          metadata?: Record<string, unknown>;
        },
      ]
    >;
    const followupNotificationPayload = notificationCalls[0]?.[0];
    expect(followupNotificationPayload).toBeDefined();
    expect(followupNotificationPayload.userId).toBe('user-1');
    expect(followupNotificationPayload.type).toBe('AGENT_ACTION_REQUIRED');
    expect(followupNotificationPayload.metadata?.workspaceId).toBe(
      'workspace-11',
    );
    expect(followupNotificationPayload.metadata?.providerId).toBe(
      'provider-11',
    );
    expect(response.executedAction?.executed).toBe(true);
    expect(response.executedAction?.message).toContain('Follow-up reminder');
    expect(saveAgentActionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'inbox',
        action: 'inbox.schedule_followup',
        executed: true,
        approvalRequired: true,
      }),
    );
  });

  it('lists user-scoped agent action audits', async () => {
    const service = createService();
    findAgentActionAuditMock.mockResolvedValue([
      {
        id: 'audit-1',
        userId: 'user-1',
      },
    ]);

    const result = await service.listAgentActionAuditsForUser({
      userId: 'user-1',
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(findAgentActionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 10,
      }),
    );
  });

  it('exports user-scoped agent action audits snapshot', async () => {
    const service = createService();
    findAgentActionAuditMock.mockResolvedValue([
      {
        id: 'audit-1',
        userId: 'user-1',
        requestId: 'req-1',
        skill: 'inbox',
        action: 'inbox.compose_reply_draft',
        executed: true,
        approvalRequired: true,
        approvalTokenSuffix: 'abcd1234',
        message: 'Draft created',
        metadata: { threadId: 'thread-1' },
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
        updatedAt: new Date('2026-02-16T00:00:00.000Z'),
      },
    ] as AgentActionAudit[]);

    const result = await service.exportAgentActionDataForUser({
      userId: 'user-1',
      limit: 9999,
    });
    const payload = JSON.parse(result.dataJson) as {
      retentionPolicy: { retentionDays: number; autoPurgeEnabled: boolean };
      summary: { totalAudits: number; executedCount: number };
      audits: Array<{ id: string; executed: boolean }>;
    };

    expect(findAgentActionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 500,
      }),
    );
    expect(payload.summary.totalAudits).toBe(1);
    expect(payload.summary.executedCount).toBe(1);
    expect(payload.retentionPolicy).toEqual(
      expect.objectContaining({
        retentionDays: 365,
        autoPurgeEnabled: true,
      }),
    );
    expect(payload.audits).toEqual([
      expect.objectContaining({
        id: 'audit-1',
        executed: true,
      }),
    ]);
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'agent_action_audit_data_export_requested',
      }),
    );
  });

  it('purges agent action audits using retention policy', async () => {
    const service = createService();
    deleteExecuteMock.mockResolvedValue({ affected: 4 });

    const result = await service.purgeAgentActionAuditRetentionData({
      retentionDays: 0,
      userId: '',
      actorUserId: 'admin-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        deletedRows: 4,
        retentionDays: 7,
        userScoped: false,
      }),
    );
    const whereCall = deleteWhereMock.mock.calls[0] as [
      string,
      { cutoff: string },
    ];
    expect(whereCall[0]).toBe('"createdAt" < :cutoff');
    expect(typeof whereCall[1].cutoff).toBe('string');
    expect(deleteAndWhereMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'agent_action_audit_retention_purged',
      }),
    );
  });

  it('supports user-scoped agent action retention purge', async () => {
    const service = createService();
    deleteExecuteMock.mockResolvedValue({ affected: 1 });

    const result = await service.purgeAgentActionAuditRetentionData({
      retentionDays: 9999,
      userId: 'user-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        deletedRows: 1,
        retentionDays: 3650,
        userScoped: true,
      }),
    );
    expect(deleteAndWhereMock).toHaveBeenCalledWith('"userId" = :userId', {
      userId: 'user-1',
    });
  });
});
