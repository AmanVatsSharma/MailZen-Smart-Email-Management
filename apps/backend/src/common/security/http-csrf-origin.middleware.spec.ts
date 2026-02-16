/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { createHttpCsrfOriginProtectionMiddleware } from './http-csrf-origin.middleware';

describe('createHttpCsrfOriginProtectionMiddleware', () => {
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

  it('allows write requests without session cookie', () => {
    const middleware = createHttpCsrfOriginProtectionMiddleware(
      {
        enabled: true,
        trustedOrigins: ['http://localhost:3000'],
        excludedPaths: [],
        enforceMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
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
      } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('allows cookie-authenticated requests from trusted origin', () => {
    const middleware = createHttpCsrfOriginProtectionMiddleware(
      {
        enabled: true,
        trustedOrigins: ['http://localhost:3000'],
        excludedPaths: [],
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
        headers: {
          cookie: 'token=abc123',
          origin: 'http://localhost:3000',
          host: 'localhost:4000',
        },
      } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('blocks cookie-authenticated requests from untrusted origin', () => {
    const middleware = createHttpCsrfOriginProtectionMiddleware(
      {
        enabled: true,
        trustedOrigins: ['http://localhost:3000'],
        excludedPaths: [],
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
        headers: {
          cookie: 'token=abc123',
          origin: 'https://evil.example',
          host: 'localhost:4000',
        },
      } as never,
      response as never,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'CSRF origin validation failed.',
      }),
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('allows cookie-authenticated requests with same-host origin', () => {
    const middleware = createHttpCsrfOriginProtectionMiddleware(
      {
        enabled: true,
        trustedOrigins: [],
        excludedPaths: [],
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
        headers: {
          cookie: 'token=abc123',
          origin: 'http://localhost:4000',
          host: 'localhost:4000',
        },
      } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('skips csrf block for bearer-authorized requests', () => {
    const middleware = createHttpCsrfOriginProtectionMiddleware(
      {
        enabled: true,
        trustedOrigins: [],
        excludedPaths: [],
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
        headers: {
          cookie: 'token=abc123',
          authorization: 'Bearer test-token',
        },
      } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });
});
