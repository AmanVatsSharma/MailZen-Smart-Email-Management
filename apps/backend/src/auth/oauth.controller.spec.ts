import { Request, Response } from 'express';
import { buildOAuthState } from './oauth-state.util';
import { GoogleOAuthController } from './oauth.controller';

describe('GoogleOAuthController', () => {
  type TestResponse = {
    headers: Map<string, string>;
    statusCode: number;
    body: unknown;
    jsonBody: unknown;
    redirectUrl?: string;
    setHeader: jest.Mock;
    getHeader: jest.Mock;
    status: jest.Mock;
    send: jest.Mock;
    json: jest.Mock;
    redirect: jest.Mock;
  };

  const envBackup = {
    frontendUrl: process.env.FRONTEND_URL,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
    jwtSecret: process.env.JWT_SECRET,
  };

  const createResponse = (): TestResponse => {
    const headers = new Map<string, string>();
    const response: TestResponse = {
      headers,
      statusCode: 200,
      body: undefined,
      jsonBody: undefined,
      redirectUrl: undefined,
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
      json: jest.fn((body: unknown) => {
        response.jsonBody = body;
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
    requestId?: string;
    userAgent?: string;
    ip?: string;
  }): Request =>
    ({
      headers: {
        ...(input?.requestId ? { 'x-request-id': input.requestId } : {}),
        ...(input?.userAgent ? { 'user-agent': input.userAgent } : {}),
      },
      ip: input?.ip || '127.0.0.1',
    }) as unknown as Request;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_REDIRECT_URI =
      'http://localhost:4000/auth/google/callback';
    process.env.JWT_SECRET = 'oauth-test-secret';
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.FRONTEND_URL = envBackup.frontendUrl;
    process.env.GOOGLE_CLIENT_ID = envBackup.googleClientId;
    process.env.GOOGLE_CLIENT_SECRET = envBackup.googleClientSecret;
    process.env.GOOGLE_REDIRECT_URI = envBackup.googleRedirectUri;
    process.env.JWT_SECRET = envBackup.jwtSecret;
  });

  function createController() {
    const userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    const auditLogRepo = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn(),
    };
    const authService = {
      login: jest.fn(),
      generateRefreshToken: jest.fn(),
    };
    const sessionCookie = {
      setTokenCookie: jest.fn(),
    };
    const emailProviderService = {
      connectGmailFromOAuthTokens: jest.fn(),
      listProvidersUi: jest.fn(),
      syncProvider: jest.fn(),
    };
    const mailboxService = {
      getUserMailboxes: jest.fn(),
    };

    const controller = new GoogleOAuthController(
      userRepo as never,
      auditLogRepo as never,
      authService as never,
      sessionCookie as never,
      emailProviderService as never,
      mailboxService as never,
    );

    return {
      controller,
      userRepo,
      auditLogRepo,
      authService,
      sessionCookie,
      emailProviderService,
      mailboxService,
    };
  }

  it('returns 500 on start when OAuth config is missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const { controller } = createController();
    const response = createResponse();

    controller.start(
      response as unknown as Response,
      createRequest(),
      undefined,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.send).toHaveBeenCalledWith('Google OAuth not configured');
  });

  it('redirects to Google on start when configured', () => {
    const { controller } = createController();
    const response = createResponse();

    controller.start(
      response as unknown as Response,
      createRequest({ requestId: 'oauth-req-1' }),
      '/settings',
    );

    expect(response.redirectUrl).toContain(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(response.headers.get('x-request-id')).toBe('oauth-req-1');
  });

  it('handles callback provider error and records audit log', async () => {
    const { controller, auditLogRepo } = createController();
    const response = createResponse();

    await controller.callback(
      createRequest(),
      response as unknown as Response,
      undefined,
      undefined,
      'access_denied',
      'redirect',
    );

    expect(auditLogRepo.save).toHaveBeenCalledTimes(1);
    expect(response.redirectUrl).toBe(
      'http://localhost:3000/auth/login?error=access_denied',
    );
  });

  it('handles callback missing code/state', async () => {
    const { controller, auditLogRepo } = createController();
    const response = createResponse();

    await controller.callback(
      createRequest(),
      response as unknown as Response,
      undefined,
      undefined,
      undefined,
      'redirect',
    );

    expect(auditLogRepo.save).toHaveBeenCalledTimes(1);
    expect(response.redirectUrl).toBe(
      'http://localhost:3000/auth/login?error=Missing%20code%2Fstate',
    );
  });

  it('returns json success payload for valid callback in json mode', async () => {
    const {
      controller,
      userRepo,
      authService,
      emailProviderService,
      mailboxService,
      sessionCookie,
      auditLogRepo,
    } = createController();
    const response = createResponse();
    const state = buildOAuthState('/inbox');
    const oauthClient = {
      getToken: jest.fn().mockResolvedValue({
        tokens: {
          id_token: 'id-token',
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expiry_date: 1700000000000,
        },
      }),
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: 'founder@mailzen.com',
          sub: 'google-sub-1',
          name: 'Founder',
          email_verified: true,
        }),
      }),
    };
    (
      controller as unknown as {
        oauthClient: typeof oauthClient;
      }
    ).oauthClient = oauthClient;

    userRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    userRepo.create.mockImplementation((payload: unknown) => payload);
    userRepo.save.mockResolvedValue({
      id: 'user-1',
      email: 'founder@mailzen.com',
      name: 'Founder',
      role: 'USER',
      isEmailVerified: true,
    });
    authService.login.mockReturnValue({ accessToken: 'jwt-access-token' });
    authService.generateRefreshToken.mockResolvedValue('jwt-refresh-token');
    emailProviderService.connectGmailFromOAuthTokens.mockResolvedValue({
      id: 'provider-1',
    });
    emailProviderService.syncProvider.mockResolvedValue(undefined);
    mailboxService.getUserMailboxes.mockResolvedValue([]);
    auditLogRepo.save.mockResolvedValue(undefined);

    await controller.callback(
      createRequest({ userAgent: 'jest', ip: '127.0.0.1' }),
      response as unknown as Response,
      'google-code',
      state,
      undefined,
      'json',
    );

    expect(sessionCookie.setTokenCookie).toHaveBeenCalledWith(
      response as unknown as Response,
      'jwt-access-token',
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        token: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        requiresAliasSetup: true,
      }),
    );
  });

  it('falls back to frontend success path for external redirect overrides', async () => {
    const {
      controller,
      userRepo,
      authService,
      emailProviderService,
      mailboxService,
      sessionCookie,
      auditLogRepo,
    } = createController();
    const response = createResponse();
    const state = buildOAuthState('https://evil.example/phishing');
    const oauthClient = {
      getToken: jest.fn().mockResolvedValue({
        tokens: {
          id_token: 'id-token',
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expiry_date: 1700000000000,
        },
      }),
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: 'founder@mailzen.com',
          sub: 'google-sub-1',
          name: 'Founder',
          email_verified: true,
        }),
      }),
    };
    (
      controller as unknown as {
        oauthClient: typeof oauthClient;
      }
    ).oauthClient = oauthClient;

    userRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    userRepo.create.mockImplementation((payload: unknown) => payload);
    userRepo.save.mockResolvedValue({
      id: 'user-1',
      email: 'founder@mailzen.com',
      name: 'Founder',
      role: 'USER',
      isEmailVerified: true,
    });
    authService.login.mockReturnValue({ accessToken: 'jwt-access-token' });
    authService.generateRefreshToken.mockResolvedValue('jwt-refresh-token');
    emailProviderService.connectGmailFromOAuthTokens.mockResolvedValue({
      id: 'provider-1',
    });
    emailProviderService.syncProvider.mockResolvedValue(undefined);
    mailboxService.getUserMailboxes.mockResolvedValue([{ id: 'mailbox-1' }]);
    auditLogRepo.save.mockResolvedValue(undefined);

    await controller.callback(
      createRequest({ userAgent: 'jest', ip: '127.0.0.1' }),
      response as unknown as Response,
      'google-code',
      state,
      undefined,
      undefined,
    );

    expect(sessionCookie.setTokenCookie).toHaveBeenCalledWith(
      response as unknown as Response,
      'jwt-access-token',
    );
    expect(response.redirectUrl).toBe(
      'http://localhost:3000/auth/oauth-success',
    );
  });
});
