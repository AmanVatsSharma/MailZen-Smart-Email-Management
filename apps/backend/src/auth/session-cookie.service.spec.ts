import { SessionCookieService } from './session-cookie.service';

describe('SessionCookieService', () => {
  let service: SessionCookieService;
  let response: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCookieName = process.env.MAILZEN_SESSION_COOKIE_NAME;
  const originalSameSite = process.env.MAILZEN_SESSION_COOKIE_SAMESITE;
  const originalSecure = process.env.MAILZEN_SESSION_COOKIE_SECURE;
  const originalDomain = process.env.MAILZEN_SESSION_COOKIE_DOMAIN;
  const originalPath = process.env.MAILZEN_SESSION_COOKIE_PATH;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    delete process.env.MAILZEN_SESSION_COOKIE_NAME;
    delete process.env.MAILZEN_SESSION_COOKIE_SAMESITE;
    delete process.env.MAILZEN_SESSION_COOKIE_SECURE;
    delete process.env.MAILZEN_SESSION_COOKIE_DOMAIN;
    delete process.env.MAILZEN_SESSION_COOKIE_PATH;

    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    service = new SessionCookieService();
  });

  afterAll(() => {
    if (typeof originalNodeEnv === 'string') {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (typeof originalCookieName === 'string') {
      process.env.MAILZEN_SESSION_COOKIE_NAME = originalCookieName;
    } else {
      delete process.env.MAILZEN_SESSION_COOKIE_NAME;
    }
    if (typeof originalSameSite === 'string') {
      process.env.MAILZEN_SESSION_COOKIE_SAMESITE = originalSameSite;
    } else {
      delete process.env.MAILZEN_SESSION_COOKIE_SAMESITE;
    }
    if (typeof originalSecure === 'string') {
      process.env.MAILZEN_SESSION_COOKIE_SECURE = originalSecure;
    } else {
      delete process.env.MAILZEN_SESSION_COOKIE_SECURE;
    }
    if (typeof originalDomain === 'string') {
      process.env.MAILZEN_SESSION_COOKIE_DOMAIN = originalDomain;
    } else {
      delete process.env.MAILZEN_SESSION_COOKIE_DOMAIN;
    }
    if (typeof originalPath === 'string') {
      process.env.MAILZEN_SESSION_COOKIE_PATH = originalPath;
    } else {
      delete process.env.MAILZEN_SESSION_COOKIE_PATH;
    }
  });

  it('sets token cookie with safe defaults', () => {
    service.setTokenCookie(response as never, 'token-value');

    expect(response.cookie).toHaveBeenCalledWith(
      'token',
      'token-value',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      }),
    );
  });

  it('supports configurable cookie name', () => {
    process.env.MAILZEN_SESSION_COOKIE_NAME = 'mailzen_session';
    const cookieNameService = new SessionCookieService();

    cookieNameService.setTokenCookie(response as never, 'token-value');

    expect(response.cookie).toHaveBeenCalledWith(
      'mailzen_session',
      'token-value',
      expect.objectContaining({
        httpOnly: true,
      }),
    );
  });

  it('applies cookie env overrides for sameSite, secure, domain, and path', () => {
    process.env.MAILZEN_SESSION_COOKIE_SAMESITE = 'strict';
    process.env.MAILZEN_SESSION_COOKIE_SECURE = 'true';
    process.env.MAILZEN_SESSION_COOKIE_DOMAIN = 'MAILZEN.COM';
    process.env.MAILZEN_SESSION_COOKIE_PATH = 'portal';

    service.setTokenCookie(response as never, 'token-value');

    expect(response.cookie).toHaveBeenCalledWith(
      'token',
      'token-value',
      expect.objectContaining({
        sameSite: 'strict',
        secure: true,
        domain: 'mailzen.com',
        path: '/portal',
      }),
    );
  });

  it('forces secure cookie when sameSite=none', () => {
    process.env.MAILZEN_SESSION_COOKIE_SAMESITE = 'none';
    process.env.MAILZEN_SESSION_COOKIE_SECURE = 'false';

    service.setTokenCookie(response as never, 'token-value');

    expect(response.cookie).toHaveBeenCalledWith(
      'token',
      'token-value',
      expect.objectContaining({
        sameSite: 'none',
        secure: true,
      }),
    );
  });

  it('skips set cookie call when token is empty', () => {
    service.setTokenCookie(response as never, '');
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('clears token cookie using resolved options', () => {
    process.env.MAILZEN_SESSION_COOKIE_SAMESITE = 'strict';
    process.env.MAILZEN_SESSION_COOKIE_SECURE = 'true';
    process.env.MAILZEN_SESSION_COOKIE_DOMAIN = 'mailzen.com';
    process.env.MAILZEN_SESSION_COOKIE_PATH = '/';

    service.clearTokenCookie(response as never);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
        domain: 'mailzen.com',
        path: '/',
      }),
    );
  });

  it('clears configured cookie name', () => {
    process.env.MAILZEN_SESSION_COOKIE_NAME = 'mailzen_session';
    const cookieNameService = new SessionCookieService();

    cookieNameService.clearTokenCookie(response as never);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'mailzen_session',
      expect.objectContaining({
        httpOnly: true,
      }),
    );
  });
});
