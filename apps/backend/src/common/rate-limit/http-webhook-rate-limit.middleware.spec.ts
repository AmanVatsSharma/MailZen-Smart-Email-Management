/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { createHttpWebhookRateLimitMiddleware } from './http-webhook-rate-limit.middleware';

describe('createHttpWebhookRateLimitMiddleware', () => {
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

  it('applies webhook throttling on configured webhook paths', () => {
    const middleware = createHttpWebhookRateLimitMiddleware(
      {
        enabled: true,
        maxRequests: 1,
        windowMs: 60_000,
        webhookPaths: ['/gmail-sync/webhooks/push'],
        enforceMethods: ['POST'],
      },
      logger,
    );
    const next = jest.fn();
    const request = {
      method: 'POST',
      path: '/gmail-sync/webhooks/push',
      originalUrl: '/gmail-sync/webhooks/push',
      headers: {},
      ip: '127.0.0.1',
    } as never;

    middleware(request, response as never, next);
    middleware(request, response as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Too many webhook requests. Please retry later.',
      }),
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('ignores non-webhook paths', () => {
    const middleware = createHttpWebhookRateLimitMiddleware(
      {
        enabled: true,
        maxRequests: 1,
        windowMs: 60_000,
        webhookPaths: ['/gmail-sync/webhooks/push'],
        enforceMethods: ['POST'],
      },
      logger,
    );
    const next = jest.fn();

    middleware(
      {
        method: 'POST',
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

  it('applies webhook throttling for nested webhook provider paths', () => {
    const middleware = createHttpWebhookRateLimitMiddleware(
      {
        enabled: true,
        maxRequests: 1,
        windowMs: 60_000,
        webhookPaths: ['/billing/webhooks'],
        enforceMethods: ['POST'],
      },
      logger,
    );
    const next = jest.fn();
    const request = {
      method: 'POST',
      path: '/billing/webhooks/stripe',
      originalUrl: '/billing/webhooks/stripe',
      headers: {},
      ip: '127.0.0.1',
    } as never;

    middleware(request, response as never, next);
    middleware(request, response as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.headers.get('x-webhook-rate-limit-limit')).toBe('1');
  });

  it('warns and bypasses when enabled without webhook paths', () => {
    const middleware = createHttpWebhookRateLimitMiddleware(
      {
        enabled: true,
        maxRequests: 1,
        windowMs: 60_000,
        webhookPaths: [],
        enforceMethods: ['POST'],
      },
      logger,
    );
    const next = jest.fn();

    middleware(
      {
        method: 'POST',
        path: '/billing/webhooks/stripe',
        originalUrl: '/billing/webhooks/stripe',
        headers: {},
        ip: '127.0.0.1',
      } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('http_webhook_rate_limit_paths_missing'),
    );
  });

  it('bypasses throttling for non-enforced methods', () => {
    const middleware = createHttpWebhookRateLimitMiddleware(
      {
        enabled: true,
        maxRequests: 1,
        windowMs: 60_000,
        webhookPaths: ['/gmail-sync/webhooks/push'],
        enforceMethods: ['POST'],
      },
      logger,
    );
    const next = jest.fn();
    const request = {
      method: 'GET',
      path: '/gmail-sync/webhooks/push',
      originalUrl: '/gmail-sync/webhooks/push',
      headers: {},
      ip: '127.0.0.1',
    } as never;

    middleware(request, response as never, next);
    middleware(request, response as never, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).not.toHaveBeenCalled();
  });
});
