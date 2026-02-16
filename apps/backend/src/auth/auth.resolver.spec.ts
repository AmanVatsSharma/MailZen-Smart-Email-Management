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
      | 'createVerificationToken'
      | 'createSignupOtp'
      | 'verifySignupOtp'
    >
  > = {
    login: jest.fn(),
    generateRefreshToken: jest.fn(),
    createVerificationToken: jest.fn(),
    createSignupOtp: jest.fn(),
    verifySignupOtp: jest.fn(),
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
    userRepoMock.findOne.mockResolvedValue(null as never);

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
    expect(result).toBe(true);
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
});
