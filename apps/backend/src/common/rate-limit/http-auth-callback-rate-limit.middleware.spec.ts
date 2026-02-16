/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { createHttpAuthCallbackRateLimitMiddleware } from './http-auth-callback-rate-limit.middleware';

describe('createHttpAuthCallbackRateLimitMiddleware', () => {
  type TestResponse = {
    headers: Map<string, string>;
    statusCode: number;
    body: unknown;
    setHeader: jest.Mock;
    getHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
  };

  const createResponse = (): TestResponse => {
    const headers = new Map<string, string>();
    const response = {
      headers,
      statusCode: 200,
      body: null as unknown,
      setHeader: jest.fn((key: string, value: string) => {
        headers.set(key.toLowerCase(), value);
      }),
      getHeader: jest.fn((key: string) => headers.get(key.toLowerCase())),
      status: jest.fn((value: number) => {
        response.statusCode = value;
        return response;
      }),
      json: jest.fn((value: unknown) => {
        response.body = value;
        return response;
      }),
    };
    return response;
  };

  let response: TestResponse;
  const logger = {
    warn: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    response = createResponse();
    jest.clearAllMocks();
  });

  it('applies callback-specific throttling on configured callback paths', () => {
    const middleware = createHttpAuthCallbackRateLimitMiddleware(
      {
        enabled: true,
        maxRequests: 1,
        windowMs: 60_000,
        callbackPaths: ['/auth/google/callback'],
      },
      logger,
    );
    const next = jest.fn();
    const request = {
      method: 'GET',
      path: '/auth/google/callback',
      originalUrl: '/auth/google/callback',
      headers: {},
      ip: '127.0.0.1',
    } as never;

    middleware(request, response as never, next);
    middleware(request, response as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Too many authentication callback attempts. Please retry later.',
      }),
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('ignores non-callback paths', () => {
    const middleware = createHttpAuthCallbackRateLimitMiddleware(
      {
        enabled: true,
        maxRequests: 1,
        windowMs: 60_000,
        callbackPaths: ['/auth/google/callback'],
      },
      logger,
    );
    const next = jest.fn();

    middleware(
      {
        method: 'GET',
        path: '/graphql',
        originalUrl: '/graphql',
        headers: {},
        ip: '127.0.0.1',
      } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('warns and bypasses when enabled without callback paths', () => {
    const middleware = createHttpAuthCallbackRateLimitMiddleware(
      {
        enabled: true,
        maxRequests: 1,
        windowMs: 60_000,
        callbackPaths: [],
      },
      logger,
    );
    const next = jest.fn();

    middleware(
      {
        method: 'GET',
        path: '/auth/google/callback',
        originalUrl: '/auth/google/callback',
        headers: {},
        ip: '127.0.0.1',
      } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('http_auth_callback_rate_limit_paths_missing'),
    );
  });
});
