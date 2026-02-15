/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { dispatchSmsOtp } from './sms-dispatcher.util';

describe('dispatchSmsOtp', () => {
  const envBackup = {
    provider: process.env.MAILZEN_SMS_PROVIDER,
    webhookUrl: process.env.MAILZEN_SMS_WEBHOOK_URL,
    webhookToken: process.env.MAILZEN_SMS_WEBHOOK_TOKEN,
    strict: process.env.MAILZEN_SMS_STRICT_DELIVERY,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    delete process.env.MAILZEN_SMS_PROVIDER;
    delete process.env.MAILZEN_SMS_WEBHOOK_URL;
    delete process.env.MAILZEN_SMS_WEBHOOK_TOKEN;
    delete process.env.MAILZEN_SMS_STRICT_DELIVERY;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    if (typeof envBackup.provider === 'string') {
      process.env.MAILZEN_SMS_PROVIDER = envBackup.provider;
    } else {
      delete process.env.MAILZEN_SMS_PROVIDER;
    }
    if (typeof envBackup.webhookUrl === 'string') {
      process.env.MAILZEN_SMS_WEBHOOK_URL = envBackup.webhookUrl;
    } else {
      delete process.env.MAILZEN_SMS_WEBHOOK_URL;
    }
    if (typeof envBackup.webhookToken === 'string') {
      process.env.MAILZEN_SMS_WEBHOOK_TOKEN = envBackup.webhookToken;
    } else {
      delete process.env.MAILZEN_SMS_WEBHOOK_TOKEN;
    }
    if (typeof envBackup.strict === 'string') {
      process.env.MAILZEN_SMS_STRICT_DELIVERY = envBackup.strict;
    } else {
      delete process.env.MAILZEN_SMS_STRICT_DELIVERY;
    }
    if (typeof envBackup.nodeEnv === 'string') {
      process.env.NODE_ENV = envBackup.nodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it('logs OTP in console mode by default', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await dispatchSmsOtp({
      phoneNumber: '+15550000000',
      code: '123456',
      purpose: 'SIGNUP_OTP',
    });

    expect(result).toEqual({
      delivered: true,
      provider: 'CONSOLE',
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('OTP (SIGNUP_OTP)'),
    );
  });

  it('dispatches webhook request when provider is WEBHOOK', async () => {
    process.env.MAILZEN_SMS_PROVIDER = 'WEBHOOK';
    process.env.MAILZEN_SMS_WEBHOOK_URL = 'https://sms.mailzen.test/send';
    process.env.MAILZEN_SMS_WEBHOOK_TOKEN = 'token-1';
    const fetchSpy: jest.SpiedFunction<typeof fetch> = jest.spyOn(
      global,
      'fetch',
    );
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    const result = await dispatchSmsOtp({
      phoneNumber: '+15550000000',
      code: '654321',
      purpose: 'PHONE_VERIFY_OTP',
    });

    expect(result).toEqual({
      delivered: true,
      provider: 'WEBHOOK',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://sms.mailzen.test/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer token-1',
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('throws in strict mode when webhook delivery fails', async () => {
    process.env.MAILZEN_SMS_PROVIDER = 'WEBHOOK';
    process.env.MAILZEN_SMS_WEBHOOK_URL = 'https://sms.mailzen.test/send';
    process.env.MAILZEN_SMS_STRICT_DELIVERY = 'true';
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(
      dispatchSmsOtp({
        phoneNumber: '+15550000000',
        code: '654321',
        purpose: 'PHONE_VERIFY_OTP',
      }),
    ).rejects.toThrow('SMS delivery failed');
  });

  it('returns non-delivered response in non-strict mode', async () => {
    process.env.MAILZEN_SMS_PROVIDER = 'WEBHOOK';
    process.env.MAILZEN_SMS_WEBHOOK_URL = 'https://sms.mailzen.test/send';
    process.env.MAILZEN_SMS_STRICT_DELIVERY = 'false';
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    const result = await dispatchSmsOtp({
      phoneNumber: '+15550000000',
      code: '654321',
      purpose: 'PHONE_VERIFY_OTP',
    });

    expect(result.delivered).toBe(false);
    expect(result.provider).toBe('WEBHOOK');
    expect(result.failureReason).toContain('status 500');
  });
});
