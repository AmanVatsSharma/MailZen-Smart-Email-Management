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
import { User } from '../user/entities/user.entity';
import { AgentAssistInput } from './dto/agent-assist.input';
import { AiAgentGatewayService } from './ai-agent-gateway.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AiAgentGatewayService', () => {
  const createVerificationTokenMock = jest.fn();
  const findOneMock = jest.fn();

  const authService = {
    createVerificationToken: createVerificationTokenMock,
  } as unknown as Pick<AuthService, 'createVerificationToken'>;

  const userRepo = {
    findOne: findOneMock,
  } as unknown as Pick<Repository<User>, 'findOne'>;

  const createService = () =>
    new AiAgentGatewayService(
      authService as AuthService,
      userRepo as Repository<User>,
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
});
