/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { AuditLog } from './entities/audit-log.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { SignupVerification } from '../phone/entities/signup-verification.entity';
import { dispatchSmsOtp } from '../common/sms/sms-dispatcher.util';

jest.mock('../common/sms/sms-dispatcher.util', () => ({
  dispatchSmsOtp: jest.fn(),
}));

describe('AuthService signup OTP delivery', () => {
  let service: AuthService;
  let signupVerificationRepo: jest.Mocked<Repository<SignupVerification>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  const originalSignupOtpMaxAttempts =
    process.env.MAILZEN_SIGNUP_OTP_MAX_ATTEMPTS;
  const dispatchSmsOtpMock = dispatchSmsOtp as jest.MockedFunction<
    typeof dispatchSmsOtp
  >;

  beforeEach(() => {
    const userRepo = {} as jest.Mocked<Repository<User>>;
    const sessionRepo = {} as jest.Mocked<Repository<UserSession>>;
    auditLogRepo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    const verificationRepo = {} as jest.Mocked<Repository<VerificationToken>>;
    signupVerificationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<SignupVerification>>;
    delete process.env.MAILZEN_SIGNUP_OTP_MAX_ATTEMPTS;

    service = new AuthService(
      { sign: jest.fn(), verify: jest.fn() } as unknown as JwtService,
      userRepo,
      sessionRepo,
      auditLogRepo,
      verificationRepo,
      signupVerificationRepo,
    );
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (typeof originalSignupOtpMaxAttempts === 'string') {
      process.env.MAILZEN_SIGNUP_OTP_MAX_ATTEMPTS =
        originalSignupOtpMaxAttempts;
      return;
    }
    delete process.env.MAILZEN_SIGNUP_OTP_MAX_ATTEMPTS;
  });

  it('returns true when signup otp dispatch succeeds', async () => {
    signupVerificationRepo.create.mockReturnValue({
      id: 'signup-verification-1',
      phoneNumber: '+15550000000',
      code: '111111',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as SignupVerification);
    signupVerificationRepo.save.mockResolvedValue({
      id: 'signup-verification-1',
      phoneNumber: '+15550000000',
      code: '111111',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as SignupVerification);
    dispatchSmsOtpMock.mockResolvedValue({
      delivered: true,
      provider: 'CONSOLE',
    });

    const result = await service.createSignupOtp('+15550000000');

    expect(result).toBe(true);
    expect(dispatchSmsOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '+15550000000',
        purpose: 'SIGNUP_OTP',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_signup_otp_requested',
      }),
    );
  });

  it('deletes verification row and throws when delivery fails', async () => {
    signupVerificationRepo.create.mockReturnValue({
      id: 'signup-verification-2',
      phoneNumber: '+15550000000',
      code: '222222',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as SignupVerification);
    signupVerificationRepo.save.mockResolvedValue({
      id: 'signup-verification-2',
      phoneNumber: '+15550000000',
      code: '222222',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as SignupVerification);
    dispatchSmsOtpMock.mockRejectedValue(new Error('transport error'));

    await expect(service.createSignupOtp('+15550000000')).rejects.toThrow(
      BadRequestException,
    );
    expect(signupVerificationRepo.delete).toHaveBeenCalledWith({
      id: 'signup-verification-2',
    });
  });

  it('marks signup verification consumed and audits successful verification', async () => {
    signupVerificationRepo.findOne.mockResolvedValue({
      id: 'signup-verification-5',
      phoneNumber: '+15550000000',
      code: '555555',
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as unknown as SignupVerification);

    const result = await service.verifySignupOtp('+15550000000', '555555');

    expect(result).toBe(true);
    expect(signupVerificationRepo.update).toHaveBeenCalledWith(
      'signup-verification-5',
      expect.objectContaining({
        consumedAt: expect.any(Date),
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_signup_otp_verified',
      }),
    );
  });

  it('rejects signup OTP verification when max attempts exceeded', async () => {
    process.env.MAILZEN_SIGNUP_OTP_MAX_ATTEMPTS = '3';
    signupVerificationRepo.findOne.mockResolvedValue({
      id: 'signup-verification-3',
      phoneNumber: '+15550000000',
      code: '333333',
      attempts: 3,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as unknown as SignupVerification);

    await expect(
      service.verifySignupOtp('+15550000000', '333333'),
    ).rejects.toThrow('Invalid or expired code');
    expect(signupVerificationRepo.update).not.toHaveBeenCalled();
  });

  it('increments attempts when signup OTP code mismatches', async () => {
    process.env.MAILZEN_SIGNUP_OTP_MAX_ATTEMPTS = '5';
    signupVerificationRepo.findOne.mockResolvedValue({
      id: 'signup-verification-4',
      phoneNumber: '+15550000000',
      code: '444444',
      attempts: 1,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as unknown as SignupVerification);

    await expect(
      service.verifySignupOtp('+15550000000', '000000'),
    ).rejects.toThrow('Invalid code');
    expect(signupVerificationRepo.update).toHaveBeenCalledWith(
      'signup-verification-4',
      {
        attempts: 2,
      },
    );
  });

  it('does not fail signup otp flow when audit write fails', async () => {
    signupVerificationRepo.create.mockReturnValue({
      id: 'signup-verification-6',
      phoneNumber: '+15550000000',
      code: '666666',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as SignupVerification);
    signupVerificationRepo.save.mockResolvedValue({
      id: 'signup-verification-6',
      phoneNumber: '+15550000000',
      code: '666666',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as SignupVerification);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));
    dispatchSmsOtpMock.mockResolvedValue({
      delivered: true,
      provider: 'CONSOLE',
    });

    const result = await service.createSignupOtp('+15550000000');

    expect(result).toBe(true);
    expect(dispatchSmsOtpMock).toHaveBeenCalledTimes(1);
  });
});
