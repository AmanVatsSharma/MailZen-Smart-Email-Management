import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthAbuseProtectionService } from './auth-abuse-protection.service';

describe('AuthAbuseProtectionService', () => {
  const envBackup = {
    enabled: process.env.AUTH_ABUSE_PROTECTION_ENABLED,
    loginWindowMs: process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
    loginMaxRequests: process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS,
    refreshWindowMs: process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS,
    refreshMaxRequests: process.env.AUTH_REFRESH_RATE_LIMIT_MAX_REQUESTS,
  };

  beforeEach(() => {
    delete process.env.AUTH_ABUSE_PROTECTION_ENABLED;
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS = '2';
    process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.AUTH_REFRESH_RATE_LIMIT_MAX_REQUESTS = '2';
  });

  afterAll(() => {
    if (typeof envBackup.enabled === 'string') {
      process.env.AUTH_ABUSE_PROTECTION_ENABLED = envBackup.enabled;
    } else {
      delete process.env.AUTH_ABUSE_PROTECTION_ENABLED;
    }
    if (typeof envBackup.loginWindowMs === 'string') {
      process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = envBackup.loginWindowMs;
    } else {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS;
    }
    if (typeof envBackup.loginMaxRequests === 'string') {
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS =
        envBackup.loginMaxRequests;
    } else {
      delete process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS;
    }
    if (typeof envBackup.refreshWindowMs === 'string') {
      process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS = envBackup.refreshWindowMs;
    } else {
      delete process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS;
    }
    if (typeof envBackup.refreshMaxRequests === 'string') {
      process.env.AUTH_REFRESH_RATE_LIMIT_MAX_REQUESTS =
        envBackup.refreshMaxRequests;
    } else {
      delete process.env.AUTH_REFRESH_RATE_LIMIT_MAX_REQUESTS;
    }
  });

  it('throws when login attempts exceed configured threshold', () => {
    const service = new AuthAbuseProtectionService();
    const request = {
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    };
    const input = {
      operation: 'login' as const,
      request,
      identifier: 'owner@mailzen.com',
    };

    service.enforceLimit(input);
    service.enforceLimit(input);
    try {
      service.enforceLimit(input);
      fail('Expected rate limit exception');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('keeps rate limits scoped by identifier', () => {
    const service = new AuthAbuseProtectionService();
    const request = {
      headers: {
        'x-forwarded-for': '203.0.113.11',
      },
    };

    service.enforceLimit({
      operation: 'login',
      request,
      identifier: 'alpha@mailzen.com',
    });
    service.enforceLimit({
      operation: 'login',
      request,
      identifier: 'beta@mailzen.com',
    });

    expect(() =>
      service.enforceLimit({
        operation: 'login',
        request,
        identifier: 'alpha@mailzen.com',
      }),
    ).not.toThrow();
  });

  it('skips enforcement when protection is disabled', () => {
    process.env.AUTH_ABUSE_PROTECTION_ENABLED = 'false';
    const service = new AuthAbuseProtectionService();
    const request = {
      headers: {
        'x-forwarded-for': '203.0.113.12',
      },
    };

    expect(() => {
      for (let index = 0; index < 10; index += 1) {
        service.enforceLimit({
          operation: 'login',
          request,
          identifier: 'disabled@mailzen.com',
        });
      }
    }).not.toThrow();
  });

  it('applies refresh limiter thresholds independently', () => {
    const service = new AuthAbuseProtectionService();
    const input = {
      operation: 'refresh' as const,
      identifier: 'refresh-token-1',
      request: {
        headers: {
          'x-forwarded-for': '203.0.113.13',
        },
      },
    };

    service.enforceLimit(input);
    service.enforceLimit(input);
    expect(() => service.enforceLimit(input)).toThrow(HttpException);
  });
});
