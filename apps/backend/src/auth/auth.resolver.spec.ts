import { Repository } from 'typeorm';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { MailboxService } from '../mailbox/mailbox.service';
import { SessionCookieService } from './session-cookie.service';
import { User } from '../user/entities/user.entity';
import { AuthAbuseProtectionService } from './auth-abuse-protection.service';

describe('AuthResolver', () => {
  const authServiceMock: jest.Mocked<
    Pick<
      AuthService,
      | 'login'
      | 'generateRefreshToken'
      | 'rotateRefreshToken'
      | 'logout'
      | 'createVerificationToken'
      | 'consumeVerificationToken'
      | 'createSignupOtp'
      | 'verifySignupOtp'
      | 'recordSecurityAuditAction'
    >
  > = {
    login: jest.fn(),
    generateRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    logout: jest.fn(),
    createVerificationToken: jest.fn(),
    consumeVerificationToken: jest.fn(),
    createSignupOtp: jest.fn(),
    verifySignupOtp: jest.fn(),
    recordSecurityAuditAction: jest.fn(),
  };
  const userServiceMock: jest.Mocked<
    Pick<UserService, 'validateUser' | 'createUser' | 'getUser'>
  > = {
    validateUser: jest.fn(),
    createUser: jest.fn(),
    getUser: jest.fn(),
  };
  const mailboxServiceMock: jest.Mocked<
    Pick<MailboxService, 'getUserMailboxes' | 'createMailbox'>
  > = {
    getUserMailboxes: jest.fn(),
    createMailbox: jest.fn(),
  };
  const sessionCookieMock: jest.Mocked<
    Pick<SessionCookieService, 'setTokenCookie' | 'clearTokenCookie'>
  > = {
    setTokenCookie: jest.fn(),
    clearTokenCookie: jest.fn(),
  };
  const authAbuseProtectionMock: jest.Mocked<
    Pick<AuthAbuseProtectionService, 'enforceLimit'>
  > = {
    enforceLimit: jest.fn(),
  };
  const userRepoMock: jest.Mocked<
    Pick<Repository<User>, 'findOne' | 'update'>
  > = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const resolver = new AuthResolver(
    authServiceMock as unknown as AuthService,
    userServiceMock as unknown as UserService,
    mailboxServiceMock as unknown as MailboxService,
    sessionCookieMock as unknown as SessionCookieService,
    authAbuseProtectionMock as unknown as AuthAbuseProtectionService,
    userRepoMock as unknown as Repository<User>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces abuse limits for login mutation', async () => {
    userServiceMock.validateUser.mockResolvedValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
      role: 'USER',
    } as User);
    authServiceMock.login.mockReturnValue({ accessToken: 'token-1' });
    authServiceMock.generateRefreshToken.mockResolvedValue('refresh-1');
    mailboxServiceMock.getUserMailboxes.mockResolvedValue([] as never[]);

    const result = await resolver.login(
      {
        email: 'owner@mailzen.com',
        password: 'password-1',
      },
      {
        req: {
          headers: {
            'x-forwarded-for': '198.51.100.10',
          },
        },
      } as never,
    );

    expect(authAbuseProtectionMock.enforceLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'login',
        identifier: 'owner@mailzen.com',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        token: 'token-1',
        refreshToken: 'refresh-1',
      }),
    );
  });

  it('enforces abuse limits for forgotPassword mutation', async () => {
    userRepoMock.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
    } as User);
    authServiceMock.createVerificationToken.mockResolvedValue('token-1');

    const result = await resolver.forgotPassword(
      { email: 'owner@mailzen.com' } as never,
      {
        req: {
          headers: {
            'x-forwarded-for': '198.51.100.11',
          },
        },
      } as never,
    );

    expect(authAbuseProtectionMock.enforceLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'forgot_password',
        identifier: 'owner@mailzen.com',
      }),
    );
    expect(authServiceMock.createVerificationToken).toHaveBeenCalledWith(
      'user-1',
      'PASSWORD_RESET',
    );
    expect(authServiceMock.recordSecurityAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_password_reset_requested',
        userId: 'user-1',
      }),
    );
    expect(result).toBe(true);
  });

  it('records audit action on resetPassword completion', async () => {
    authServiceMock.consumeVerificationToken.mockResolvedValue('user-1');
    userRepoMock.update.mockResolvedValue({} as never);

    const result = await resolver.resetPassword(
      {
        token: 'reset-token-1',
        newPassword: 'new-password-1',
      } as never,
      {
        req: {
          headers: {
            'x-forwarded-for': '198.51.100.14',
          },
        },
      } as never,
    );

    expect(authServiceMock.consumeVerificationToken).toHaveBeenCalledWith(
      'reset-token-1',
      'PASSWORD_RESET',
    );
    expect(authServiceMock.recordSecurityAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_password_reset_completed',
        userId: 'user-1',
      }),
    );
    expect(result).toBe(true);
  });

  it('records audit action on verifyEmail completion', async () => {
    authServiceMock.consumeVerificationToken.mockResolvedValue('user-2');
    userRepoMock.update.mockResolvedValue({} as never);

    const result = await resolver.verifyEmail({
      token: 'verify-token-1',
    } as never);

    expect(authServiceMock.consumeVerificationToken).toHaveBeenCalledWith(
      'verify-token-1',
      'EMAIL_VERIFY',
    );
    expect(authServiceMock.recordSecurityAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_email_verification_completed',
        userId: 'user-2',
      }),
    );
    expect(result).toBe(true);
  });

  it('records audit action on successful phone signup', async () => {
    authServiceMock.verifySignupOtp.mockResolvedValue(true);
    userServiceMock.createUser.mockResolvedValue({
      id: 'user-3',
      email: 'phone@mailzen.com',
      role: 'USER',
    } as User);
    mailboxServiceMock.createMailbox.mockResolvedValue({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
    } as never);
    authServiceMock.login.mockReturnValue({ accessToken: 'token-signup' });
    authServiceMock.generateRefreshToken.mockResolvedValue('refresh-signup');
    mailboxServiceMock.getUserMailboxes.mockResolvedValue([
      'sales@mailzen.com',
    ] as never[]);

    const result = await resolver.signupVerify(
      {
        phoneNumber: '+15550000000',
        code: '123456',
        email: 'phone@mailzen.com',
        password: 'password-1',
        desiredLocalPart: 'sales',
      } as never,
      {
        req: {
          headers: {
            'x-forwarded-for': '198.51.100.15',
          },
        },
        res: {
          cookie: jest.fn(),
          clearCookie: jest.fn(),
        },
      } as never,
    );

    expect(authServiceMock.recordSecurityAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_phone_signup_completed',
        userId: 'user-3',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        token: 'token-signup',
        refreshToken: 'refresh-signup',
      }),
    );
  });

  it('enforces abuse limits for signupSendOtp mutation', async () => {
    authServiceMock.createSignupOtp.mockResolvedValue(true);

    const result = await resolver.signupSendOtp(
      {
        phoneNumber: '+15550000000',
      },
      {
        req: {
          headers: {
            'x-forwarded-for': '198.51.100.12',
          },
        },
      } as never,
    );

    expect(authAbuseProtectionMock.enforceLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'signup_send_otp',
        identifier: '+15550000000',
      }),
    );
    expect(result).toBe(true);
  });

  it('enforces abuse limits for refresh mutation', async () => {
    authServiceMock.rotateRefreshToken.mockResolvedValue({
      token: 'token-2',
      refreshToken: 'refresh-2',
      userId: 'user-2',
    });
    userServiceMock.getUser.mockResolvedValue({
      id: 'user-2',
      email: 'member@mailzen.com',
      role: 'USER',
    } as User);
    mailboxServiceMock.getUserMailboxes.mockResolvedValue([
      'member@mailzen.com',
    ] as never[]);

    const result = await resolver.refresh({
      refreshToken: 'refresh-1',
    } as never);

    expect(authAbuseProtectionMock.enforceLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'refresh',
        identifier: 'refresh-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        token: 'token-2',
        refreshToken: 'refresh-2',
      }),
    );
  });

  it('enforces abuse limits for logout mutation when refresh token provided', async () => {
    authServiceMock.logout.mockResolvedValue(true);

    const result = await resolver.logout(
      { refreshToken: 'refresh-logout' } as never,
      {
        req: {
          headers: {
            'x-forwarded-for': '198.51.100.13',
          },
        },
      } as never,
    );

    expect(authAbuseProtectionMock.enforceLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'logout',
        identifier: 'refresh-logout',
      }),
    );
    expect(authServiceMock.logout).toHaveBeenCalledWith('refresh-logout');
    expect(result).toBe(true);
  });
});
