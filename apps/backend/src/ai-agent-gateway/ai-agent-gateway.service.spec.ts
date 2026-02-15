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
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { User } from '../user/entities/user.entity';
import { AgentAssistInput } from './dto/agent-assist.input';
import { AiAgentGatewayService } from './ai-agent-gateway.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AiAgentGatewayService', () => {
  const createVerificationTokenMock = jest.fn();
  const findOneMock = jest.fn();
  const findExternalMessagesMock = jest.fn();

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

  const createService = () =>
    new AiAgentGatewayService(
      authService as AuthService,
      userRepo as Repository<User>,
      externalEmailMessageRepo as Repository<ExternalEmailMessage>,
    );

  beforeEach(() => {
    jest.clearAllMocks();
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
    findExternalMessagesMock.mockResolvedValueOnce([
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
    expect(response.executedAction?.executed).toBe(true);
    expect(response.executedAction?.message).toContain('summary');
  });
});
