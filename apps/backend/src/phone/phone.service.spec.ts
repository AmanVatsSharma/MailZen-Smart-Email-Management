/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { PhoneVerification } from './entities/phone-verification.entity';
import { PhoneService } from './phone.service';
import { User } from '../user/entities/user.entity';
import { dispatchSmsOtp } from '../common/sms/sms-dispatcher.util';

jest.mock('../common/sms/sms-dispatcher.util', () => ({
  dispatchSmsOtp: jest.fn(),
}));

describe('PhoneService', () => {
  let service: PhoneService;
  let phoneVerificationRepo: jest.Mocked<Repository<PhoneVerification>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  const originalPhoneOtpMaxAttempts =
    process.env.MAILZEN_PHONE_OTP_MAX_ATTEMPTS;
  const dispatchSmsOtpMock = dispatchSmsOtp as jest.MockedFunction<
    typeof dispatchSmsOtp
  >;

  beforeEach(() => {
    phoneVerificationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      increment: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    } as unknown as jest.Mocked<Repository<PhoneVerification>>;
    userRepo = {
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    auditLogRepo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    service = new PhoneService(phoneVerificationRepo, userRepo, auditLogRepo);
    delete process.env.MAILZEN_PHONE_OTP_MAX_ATTEMPTS;
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (typeof originalPhoneOtpMaxAttempts === 'string') {
      process.env.MAILZEN_PHONE_OTP_MAX_ATTEMPTS = originalPhoneOtpMaxAttempts;
      return;
    }
    delete process.env.MAILZEN_PHONE_OTP_MAX_ATTEMPTS;
  });

  it('sends otp and keeps verification record on success', async () => {
    phoneVerificationRepo.create.mockReturnValue({
      id: 'verification-1',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '123456',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as PhoneVerification);
    phoneVerificationRepo.save.mockResolvedValue({
      id: 'verification-1',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '123456',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as PhoneVerification);
    dispatchSmsOtpMock.mockResolvedValue({
      delivered: true,
      provider: 'CONSOLE',
    });

    const result = await service.sendOtp('user-1', '+15550000000');

    expect(result).toBe(true);
    expect(dispatchSmsOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '+15550000000',
        purpose: 'PHONE_VERIFY_OTP',
      }),
    );
    expect(phoneVerificationRepo.delete).not.toHaveBeenCalled();
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'phone_otp_requested',
      }),
    );
  });

  it('deletes verification record when sms delivery fails', async () => {
    phoneVerificationRepo.create.mockReturnValue({
      id: 'verification-2',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '654321',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as PhoneVerification);
    phoneVerificationRepo.save.mockResolvedValue({
      id: 'verification-2',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '654321',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as PhoneVerification);
    dispatchSmsOtpMock.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.sendOtp('user-1', '+15550000000')).rejects.toThrow(
      BadRequestException,
    );
    expect(phoneVerificationRepo.delete).toHaveBeenCalledWith({
      id: 'verification-2',
    });
  });

  it('rejects verifyOtp when max attempts exceeded', async () => {
    process.env.MAILZEN_PHONE_OTP_MAX_ATTEMPTS = '3';
    phoneVerificationRepo.findOne.mockResolvedValue({
      id: 'verification-3',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '123456',
      attempts: 3,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as unknown as PhoneVerification);

    await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(
      BadRequestException,
    );
    expect(phoneVerificationRepo.increment).not.toHaveBeenCalled();
  });

  it('increments attempts when verifyOtp code mismatches', async () => {
    process.env.MAILZEN_PHONE_OTP_MAX_ATTEMPTS = '5';
    phoneVerificationRepo.findOne.mockResolvedValue({
      id: 'verification-4',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '123456',
      attempts: 1,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as unknown as PhoneVerification);

    await expect(service.verifyOtp('user-1', '000000')).rejects.toThrow(
      BadRequestException,
    );
    expect(phoneVerificationRepo.increment).toHaveBeenCalledWith(
      { id: 'verification-4' },
      'attempts',
      1,
    );
  });

  it('marks otp consumed and audits successful verification', async () => {
    const transactionMock = jest.fn(
      async (
        handler: (
          manager: {
            getRepository: (
              entity: unknown,
            ) => { update: jest.Mock<Promise<{ affected: number }>> };
          },
        ) => Promise<unknown>,
      ) =>
        handler({
        getRepository: jest.fn((entity) => {
          if (entity === PhoneVerification) {
            return {
              update: jest.fn().mockResolvedValue({ affected: 1 }),
            };
          }
          if (entity === User) {
            return {
              update: jest.fn().mockResolvedValue({ affected: 1 }),
            };
          }
          return {
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          };
        }),
        }),
    );
    phoneVerificationRepo.manager.transaction = transactionMock as never;
    phoneVerificationRepo.findOne.mockResolvedValue({
      id: 'verification-5',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '777777',
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as unknown as PhoneVerification);

    const result = await service.verifyOtp('user-1', '777777');

    expect(result).toBe(true);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'phone_otp_verified',
      }),
    );
  });

  it('does not fail otp send when audit write fails', async () => {
    phoneVerificationRepo.create.mockReturnValue({
      id: 'verification-6',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '888888',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as PhoneVerification);
    phoneVerificationRepo.save.mockResolvedValue({
      id: 'verification-6',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '888888',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as PhoneVerification);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));
    dispatchSmsOtpMock.mockResolvedValue({
      delivered: true,
      provider: 'CONSOLE',
    });

    const result = await service.sendOtp('user-1', '+15550000000');

    expect(result).toBe(true);
    expect(dispatchSmsOtpMock).toHaveBeenCalledTimes(1);
  });
});
