import { PhoneResolver } from './phone.resolver';
import { PhoneService } from './phone.service';
import { AuthAbuseProtectionService } from '../auth/auth-abuse-protection.service';

describe('PhoneResolver', () => {
  const phoneServiceMock: jest.Mocked<
    Pick<PhoneService, 'sendOtp' | 'verifyOtp'>
  > = {
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
  };
  const authAbuseProtectionMock: jest.Mocked<
    Pick<AuthAbuseProtectionService, 'enforceLimit'>
  > = {
    enforceLimit: jest.fn(),
  };

  const resolver = new PhoneResolver(
    phoneServiceMock as unknown as PhoneService,
    authAbuseProtectionMock as unknown as AuthAbuseProtectionService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces abuse limits before sending phone OTP', async () => {
    phoneServiceMock.sendOtp.mockResolvedValue(true);

    const result = await resolver.sendPhoneOtp('+15550000000', {
      req: {
        user: { id: 'user-1' },
        headers: {
          'x-forwarded-for': '198.51.100.20',
        },
      },
    } as never);

    expect(authAbuseProtectionMock.enforceLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'phone_send_otp',
        identifier: '+15550000000',
      }),
    );
    expect(phoneServiceMock.sendOtp).toHaveBeenCalledWith(
      'user-1',
      '+15550000000',
    );
    expect(result).toBe(true);
  });

  it('enforces abuse limits before verifying phone OTP', async () => {
    phoneServiceMock.verifyOtp.mockResolvedValue(true);

    const result = await resolver.verifyPhoneOtp('123456', {
      req: {
        user: { id: 'user-2' },
        headers: {
          'x-forwarded-for': '198.51.100.21',
        },
      },
    } as never);

    expect(authAbuseProtectionMock.enforceLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'phone_verify_otp',
        identifier: 'user-2',
      }),
    );
    expect(phoneServiceMock.verifyOtp).toHaveBeenCalledWith('user-2', '123456');
    expect(result).toBe(true);
  });
});
