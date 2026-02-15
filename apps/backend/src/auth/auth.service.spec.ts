/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { SignupVerification } from '../phone/entities/signup-verification.entity';
import { dispatchSmsOtp } from '../common/sms/sms-dispatcher.util';

jest.mock('../common/sms/sms-dispatcher.util', () => ({
  dispatchSmsOtp: jest.fn(),
}));

describe('AuthService signup OTP delivery', () => {
  let service: AuthService;
  let signupVerificationRepo: jest.Mocked<Repository<SignupVerification>>;
  const dispatchSmsOtpMock = dispatchSmsOtp as jest.MockedFunction<
    typeof dispatchSmsOtp
  >;

  beforeEach(() => {
    const userRepo = {} as jest.Mocked<Repository<User>>;
    const sessionRepo = {} as jest.Mocked<Repository<UserSession>>;
    const verificationRepo = {} as jest.Mocked<Repository<VerificationToken>>;
    signupVerificationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<SignupVerification>>;

    service = new AuthService(
      { sign: jest.fn(), verify: jest.fn() } as unknown as JwtService,
      userRepo,
      sessionRepo,
      verificationRepo,
      signupVerificationRepo,
    );
    jest.clearAllMocks();
  });

  it('returns true when signup otp dispatch succeeds', async () => {
    signupVerificationRepo.create.mockReturnValue({
      id: 'signup-verification-1',
      phoneNumber: '+15550000000',
      code: '111111',
    } as SignupVerification);
    signupVerificationRepo.save.mockResolvedValue({
      id: 'signup-verification-1',
      phoneNumber: '+15550000000',
      code: '111111',
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
  });

  it('deletes verification row and throws when delivery fails', async () => {
    signupVerificationRepo.create.mockReturnValue({
      id: 'signup-verification-2',
      phoneNumber: '+15550000000',
      code: '222222',
    } as SignupVerification);
    signupVerificationRepo.save.mockResolvedValue({
      id: 'signup-verification-2',
      phoneNumber: '+15550000000',
      code: '222222',
    } as SignupVerification);
    dispatchSmsOtpMock.mockRejectedValue(new Error('transport error'));

    await expect(service.createSignupOtp('+15550000000')).rejects.toThrow(
      BadRequestException,
    );
    expect(signupVerificationRepo.delete).toHaveBeenCalledWith({
      id: 'signup-verification-2',
    });
  });
});
