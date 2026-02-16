import { createHttpSecurityHeadersMiddleware } from './http-security-headers.middleware';

describe('createHttpSecurityHeadersMiddleware', () => {
  type TestResponse = {
    headers: Map<string, string>;
    setHeader: jest.Mock;
  };

  const createResponse = (): TestResponse => {
    const headers = new Map<string, string>();
    return {
      headers,
      setHeader: jest.fn((key: string, value: string) => {
        headers.set(key.toLowerCase(), value);
      }),
    };
  };

  it('sets configured security headers when enabled', () => {
    const middleware = createHttpSecurityHeadersMiddleware({
      enabled: true,
      contentTypeNosniffEnabled: true,
      frameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'camera=(), microphone=()',
      crossOriginOpenerPolicy: 'same-origin',
      hstsEnabled: true,
      hstsMaxAgeSeconds: 31536000,
      hstsIncludeSubdomains: true,
      hstsPreload: true,
    });
    const res = createResponse();
    const next = jest.fn();

    middleware({} as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(res.headers.get('permissions-policy')).toBe(
      'camera=(), microphone=()',
    );
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains; preload',
    );
  });

  it('does not set headers when disabled', () => {
    const middleware = createHttpSecurityHeadersMiddleware({
      enabled: false,
      contentTypeNosniffEnabled: true,
      frameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'camera=()',
      crossOriginOpenerPolicy: 'same-origin',
      hstsEnabled: true,
      hstsMaxAgeSeconds: 31536000,
      hstsIncludeSubdomains: true,
      hstsPreload: false,
    });
    const res = createResponse();
    const next = jest.fn();

    middleware({} as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
