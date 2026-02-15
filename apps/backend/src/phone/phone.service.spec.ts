/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
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
    service = new PhoneService(phoneVerificationRepo, userRepo);
    jest.clearAllMocks();
  });

  it('sends otp and keeps verification record on success', async () => {
    phoneVerificationRepo.create.mockReturnValue({
      id: 'verification-1',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '123456',
    } as PhoneVerification);
    phoneVerificationRepo.save.mockResolvedValue({
      id: 'verification-1',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '123456',
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
  });

  it('deletes verification record when sms delivery fails', async () => {
    phoneVerificationRepo.create.mockReturnValue({
      id: 'verification-2',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '654321',
    } as PhoneVerification);
    phoneVerificationRepo.save.mockResolvedValue({
      id: 'verification-2',
      userId: 'user-1',
      phoneNumber: '+15550000000',
      code: '654321',
    } as PhoneVerification);
    dispatchSmsOtpMock.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.sendOtp('user-1', '+15550000000')).rejects.toThrow(
      BadRequestException,
    );
    expect(phoneVerificationRepo.delete).toHaveBeenCalledWith({
      id: 'verification-2',
    });
  });
});
