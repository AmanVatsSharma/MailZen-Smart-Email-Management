import { Request, Response } from 'express';
import { buildOAuthState } from '../auth/oauth-state.util';
import { ProviderOAuthController } from './provider-oauth.controller';

describe('ProviderOAuthController', () => {
  type TestResponse = {
    headers: Map<string, string>;
    statusCode: number;
    body: unknown;
    redirectUrl?: string;
    setHeader: jest.Mock;
    getHeader: jest.Mock;
    status: jest.Mock;
    send: jest.Mock;
    redirect: jest.Mock;
  };

  const envBackup = {
    frontendUrl: process.env.FRONTEND_URL,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleProviderRedirectUri: process.env.GOOGLE_PROVIDER_REDIRECT_URI,
    outlookClientId: process.env.OUTLOOK_CLIENT_ID,
    outlookProviderRedirectUri: process.env.OUTLOOK_PROVIDER_REDIRECT_URI,
    jwtSecret: process.env.JWT_SECRET,
  };

  const createResponse = (): TestResponse => {
    const headers = new Map<string, string>();
    const response: TestResponse = {
      headers,
      statusCode: 200,
      body: undefined as unknown,
      redirectUrl: undefined as string | undefined,
      setHeader: jest.fn((key: string, value: string) => {
        headers.set(key.toLowerCase(), value);
      }),
      getHeader: jest.fn((key: string) => headers.get(key.toLowerCase())),
      status: jest.fn((statusCode: number) => {
        response.statusCode = statusCode;
        return response;
      }),
      send: jest.fn((body: unknown) => {
        response.body = body;
        return response;
      }),
      redirect: jest.fn((url: string) => {
        response.redirectUrl = url;
        return response;
      }),
    };
    return response;
  };

  const createRequest = (input?: {
    userId?: string;
    requestId?: string;
    cookieHeader?: string;
  }): Request => {
    return {
      headers: {
        ...(input?.requestId ? { 'x-request-id': input.requestId } : {}),
        ...(input?.cookieHeader ? { cookie: input.cookieHeader } : {}),
      },
      user: input?.userId ? { id: input.userId } : undefined,
    } as unknown as Request;
  };

  beforeEach(() => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_PROVIDER_REDIRECT_URI =
      'http://localhost:4000/email-integration/google/callback';
    process.env.OUTLOOK_CLIENT_ID = 'outlook-client-id';
    process.env.OUTLOOK_PROVIDER_REDIRECT_URI =
      'http://localhost:4000/email-integration/microsoft/callback';
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterEach(() => {
    process.env.FRONTEND_URL = envBackup.frontendUrl;
    process.env.GOOGLE_CLIENT_ID = envBackup.googleClientId;
    process.env.GOOGLE_PROVIDER_REDIRECT_URI =
      envBackup.googleProviderRedirectUri;
    process.env.OUTLOOK_CLIENT_ID = envBackup.outlookClientId;
    process.env.OUTLOOK_PROVIDER_REDIRECT_URI =
      envBackup.outlookProviderRedirectUri;
    process.env.JWT_SECRET = envBackup.jwtSecret;
    jest.clearAllMocks();
  });

  it('starts Google provider OAuth redirect when configured', () => {
    const emailProviderService = {
      connectGmail: jest.fn(),
      connectOutlook: jest.fn(),
    };
    const controller = new ProviderOAuthController(
      emailProviderService as never,
    );
    const response = createResponse();

    controller.googleStart(
      response as unknown as Response,
      createRequest({ requestId: 'req-1' }),
      '/settings/providers',
    );

    expect(response.redirect).toHaveBeenCalledTimes(1);
    expect(response.redirectUrl).toContain(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(response.headers.get('x-request-id')).toBe('req-1');
  });

  it('returns 500 for Google start when OAuth config is missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const emailProviderService = {
      connectGmail: jest.fn(),
      connectOutlook: jest.fn(),
    };
    const controller = new ProviderOAuthController(
      emailProviderService as never,
    );
    const response = createResponse();

    controller.googleStart(
      response as unknown as Response,
      createRequest(),
      undefined,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.send).toHaveBeenCalledWith(
      'Google provider OAuth not configured',
    );
  });

  it('redirects with missing code/state error for Google callback', async () => {
    const emailProviderService = {
      connectGmail: jest.fn(),
      connectOutlook: jest.fn(),
    };
    const controller = new ProviderOAuthController(
      emailProviderService as never,
    );
    const response = createResponse();

    await controller.googleCallback(
      createRequest({ userId: 'user-1' }),
      response as unknown as Response,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    expect(response.redirectUrl).toBe(
      'http://localhost:3000/email-providers?error=Missing+code%2Fstate',
    );
  });

  it('redirects to login when callback has valid state but missing user', async () => {
    const emailProviderService = {
      connectGmail: jest.fn(),
      connectOutlook: jest.fn(),
    };
    const controller = new ProviderOAuthController(
      emailProviderService as never,
    );
    const response = createResponse();
    const state = buildOAuthState('/email-providers');

    await controller.googleCallback(
      createRequest(),
      response as unknown as Response,
      'google-code',
      state,
      undefined,
      undefined,
    );

    expect(response.redirectUrl).toBe(
      'http://localhost:3000/auth/login?redirect=%2Femail-providers&error=Session+expired.+Please+login+again.',
    );
  });

  it('connects Google provider and supports relative redirect overrides', async () => {
    const emailProviderService = {
      connectGmail: jest.fn().mockResolvedValue(undefined),
      connectOutlook: jest.fn(),
    };
    const controller = new ProviderOAuthController(
      emailProviderService as never,
    );
    const response = createResponse();
    const state = buildOAuthState('/settings/providers');

    await controller.googleCallback(
      createRequest({ userId: 'user-10' }),
      response as unknown as Response,
      'google-code',
      state,
      undefined,
      undefined,
    );

    expect(emailProviderService.connectGmail).toHaveBeenCalledWith(
      'google-code',
      'user-10',
    );
    expect(response.redirectUrl).toBe(
      'http://localhost:3000/settings/providers?provider=gmail&success=true',
    );
  });

  it('falls back to provider settings path on invalid redirect target', async () => {
    const emailProviderService = {
      connectGmail: jest.fn().mockResolvedValue(undefined),
      connectOutlook: jest.fn(),
    };
    const controller = new ProviderOAuthController(
      emailProviderService as never,
    );
    const response = createResponse();
    const state = buildOAuthState('http://[invalid-host');

    await controller.googleCallback(
      createRequest({ userId: 'user-11' }),
      response as unknown as Response,
      'google-code',
      state,
      undefined,
      undefined,
    );

    expect(response.redirectUrl).toBe(
      'http://localhost:3000/email-providers?provider=gmail&success=true',
    );
  });

  it('rejects external redirect target and falls back to provider settings', async () => {
    const emailProviderService = {
      connectGmail: jest.fn().mockResolvedValue(undefined),
      connectOutlook: jest.fn(),
    };
    const controller = new ProviderOAuthController(
      emailProviderService as never,
    );
    const response = createResponse();
    const state = buildOAuthState('https://evil.example/phishing');

    await controller.googleCallback(
      createRequest({ userId: 'user-12' }),
      response as unknown as Response,
      'google-code',
      state,
      undefined,
      undefined,
    );

    expect(response.redirectUrl).toBe(
      'http://localhost:3000/email-providers?provider=gmail&success=true',
    );
  });

  it('redirects with Outlook connect failure message', async () => {
    const emailProviderService = {
      connectGmail: jest.fn(),
      connectOutlook: jest.fn().mockRejectedValue(new Error('graph error')),
    };
    const controller = new ProviderOAuthController(
      emailProviderService as never,
    );
    const response = createResponse();
    const state = buildOAuthState('/email-providers');

    await controller.microsoftCallback(
      createRequest({ userId: 'user-21' }),
      response as unknown as Response,
      'outlook-code',
      state,
      undefined,
      undefined,
    );

    expect(emailProviderService.connectOutlook).toHaveBeenCalledWith(
      'outlook-code',
      'user-21',
    );
    expect(response.redirectUrl).toBe(
      'http://localhost:3000/email-providers?error=Failed+to+connect+Outlook',
    );
  });
});
