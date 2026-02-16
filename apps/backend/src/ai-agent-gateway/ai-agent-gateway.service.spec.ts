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
import axios from 'axios';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { BillingService } from '../billing/billing.service';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { User } from '../user/entities/user.entity';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { AgentAssistInput } from './dto/agent-assist.input';
import { AgentActionAudit } from './entities/agent-action-audit.entity';
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
      notificationEventBus as NotificationEventBusService,
    );
  const originalPlatformUrls = process.env.AI_AGENT_PLATFORM_URLS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AI_AGENT_PLATFORM_URLS;
    createAgentActionAuditMock.mockImplementation(
      (value: Record<string, unknown>) => value,
    );
    saveAgentActionAuditMock.mockResolvedValue({ id: 'audit-1' });
    findAgentActionAuditMock.mockResolvedValue([]);
    findWorkspaceMemberMock.mockResolvedValue(null);
    deleteExecuteMock.mockResolvedValue({ affected: 0 });
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
      return;
    }
    delete process.env.AI_AGENT_PLATFORM_URLS;
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
    expect(mockedAxios.post.mock.calls[0]?.[0]).toContain(
      'http://primary-agent.local',
    );
    expect(mockedAxios.post.mock.calls[1]?.[0]).toContain(
      'http://secondary-agent.local',
    );
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
  });

  it('purges agent action audits using retention policy', async () => {
    const service = createService();
    deleteExecuteMock.mockResolvedValue({ affected: 4 });

    const result = await service.purgeAgentActionAuditRetentionData({
      retentionDays: 0,
      userId: '',
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
