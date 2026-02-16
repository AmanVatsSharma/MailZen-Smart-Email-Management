/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { dispatchSmsOtp } from './sms-dispatcher.util';

describe('dispatchSmsOtp', () => {
  const envBackup = {
    provider: process.env.MAILZEN_SMS_PROVIDER,
    webhookUrl: process.env.MAILZEN_SMS_WEBHOOK_URL,
    webhookToken: process.env.MAILZEN_SMS_WEBHOOK_TOKEN,
    webhookSigningKey: process.env.MAILZEN_SMS_WEBHOOK_SIGNING_KEY,
    twilioSid: process.env.MAILZEN_SMS_TWILIO_ACCOUNT_SID,
    twilioToken: process.env.MAILZEN_SMS_TWILIO_AUTH_TOKEN,
    twilioFrom: process.env.MAILZEN_SMS_TWILIO_FROM_NUMBER,
    twilioBaseUrl: process.env.MAILZEN_SMS_TWILIO_API_BASE_URL,
    twilioTimeoutMs: process.env.MAILZEN_SMS_TWILIO_TIMEOUT_MS,
    twilioStatusCallbackUrl: process.env.MAILZEN_SMS_TWILIO_STATUS_CALLBACK_URL,
    strict: process.env.MAILZEN_SMS_STRICT_DELIVERY,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    delete process.env.MAILZEN_SMS_PROVIDER;
    delete process.env.MAILZEN_SMS_WEBHOOK_URL;
    delete process.env.MAILZEN_SMS_WEBHOOK_TOKEN;
    delete process.env.MAILZEN_SMS_WEBHOOK_SIGNING_KEY;
    delete process.env.MAILZEN_SMS_TWILIO_ACCOUNT_SID;
    delete process.env.MAILZEN_SMS_TWILIO_AUTH_TOKEN;
    delete process.env.MAILZEN_SMS_TWILIO_FROM_NUMBER;
    delete process.env.MAILZEN_SMS_TWILIO_API_BASE_URL;
    delete process.env.MAILZEN_SMS_TWILIO_TIMEOUT_MS;
    delete process.env.MAILZEN_SMS_TWILIO_STATUS_CALLBACK_URL;
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
    if (typeof envBackup.webhookSigningKey === 'string') {
      process.env.MAILZEN_SMS_WEBHOOK_SIGNING_KEY = envBackup.webhookSigningKey;
    } else {
      delete process.env.MAILZEN_SMS_WEBHOOK_SIGNING_KEY;
    }
    if (typeof envBackup.twilioSid === 'string') {
      process.env.MAILZEN_SMS_TWILIO_ACCOUNT_SID = envBackup.twilioSid;
    } else {
      delete process.env.MAILZEN_SMS_TWILIO_ACCOUNT_SID;
    }
    if (typeof envBackup.twilioToken === 'string') {
      process.env.MAILZEN_SMS_TWILIO_AUTH_TOKEN = envBackup.twilioToken;
    } else {
      delete process.env.MAILZEN_SMS_TWILIO_AUTH_TOKEN;
    }
    if (typeof envBackup.twilioFrom === 'string') {
      process.env.MAILZEN_SMS_TWILIO_FROM_NUMBER = envBackup.twilioFrom;
    } else {
      delete process.env.MAILZEN_SMS_TWILIO_FROM_NUMBER;
    }
    if (typeof envBackup.twilioBaseUrl === 'string') {
      process.env.MAILZEN_SMS_TWILIO_API_BASE_URL = envBackup.twilioBaseUrl;
    } else {
      delete process.env.MAILZEN_SMS_TWILIO_API_BASE_URL;
    }
    if (typeof envBackup.twilioTimeoutMs === 'string') {
      process.env.MAILZEN_SMS_TWILIO_TIMEOUT_MS = envBackup.twilioTimeoutMs;
    } else {
      delete process.env.MAILZEN_SMS_TWILIO_TIMEOUT_MS;
    }
    if (typeof envBackup.twilioStatusCallbackUrl === 'string') {
      process.env.MAILZEN_SMS_TWILIO_STATUS_CALLBACK_URL =
        envBackup.twilioStatusCallbackUrl;
    } else {
      delete process.env.MAILZEN_SMS_TWILIO_STATUS_CALLBACK_URL;
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

  it('adds webhook signature headers when signing key is configured', async () => {
    process.env.MAILZEN_SMS_PROVIDER = 'WEBHOOK';
    process.env.MAILZEN_SMS_WEBHOOK_URL = 'https://sms.mailzen.test/send';
    process.env.MAILZEN_SMS_WEBHOOK_SIGNING_KEY = 'sms-sign-key';
    const fetchSpy: jest.SpiedFunction<typeof fetch> = jest.spyOn(
      global,
      'fetch',
    );
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await dispatchSmsOtp({
      phoneNumber: '+15550000000',
      code: '123123',
      purpose: 'SIGNUP_OTP',
    });

    const fetchHeaders = fetchSpy.mock.calls[0]?.[1] as {
      headers?: Record<string, string>;
    };
    expect(fetchHeaders.headers).toEqual(
      expect.objectContaining({
        'x-mailzen-sms-timestamp': expect.any(String),
        'x-mailzen-sms-signature': expect.stringMatching(/^[0-9a-f]{64}$/i),
      }),
    );
  });

  it('dispatches twilio request when provider is TWILIO', async () => {
    process.env.MAILZEN_SMS_PROVIDER = 'TWILIO';
    process.env.MAILZEN_SMS_TWILIO_ACCOUNT_SID = 'AC123';
    process.env.MAILZEN_SMS_TWILIO_AUTH_TOKEN = 'token-abc';
    process.env.MAILZEN_SMS_TWILIO_FROM_NUMBER = '+15551110000';
    process.env.MAILZEN_SMS_TWILIO_API_BASE_URL = 'https://api.twilio.test';
    process.env.MAILZEN_SMS_TWILIO_STATUS_CALLBACK_URL =
      'https://mailzen.test/sms/status';
    const fetchSpy: jest.SpiedFunction<typeof fetch> = jest.spyOn(
      global,
      'fetch',
    );
    fetchSpy.mockResolvedValue({ ok: true, status: 201 } as Response);

    const result = await dispatchSmsOtp({
      phoneNumber: '+15550000000',
      code: '987654',
      purpose: 'PHONE_VERIFY_OTP',
    });

    expect(result).toEqual({
      delivered: true,
      provider: 'TWILIO',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.twilio.test/2010-04-01/Accounts/AC123/Messages.json',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: expect.stringMatching(/^Basic\s+/),
          'content-type': 'application/x-www-form-urlencoded',
        }),
        body: expect.stringContaining('To=%2B15550000000'),
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

  it('returns non-delivered response for twilio failures in non-strict mode', async () => {
    process.env.MAILZEN_SMS_PROVIDER = 'TWILIO';
    process.env.MAILZEN_SMS_STRICT_DELIVERY = 'false';
    process.env.MAILZEN_SMS_TWILIO_ACCOUNT_SID = 'AC123';
    process.env.MAILZEN_SMS_TWILIO_AUTH_TOKEN = 'token-abc';
    process.env.MAILZEN_SMS_TWILIO_FROM_NUMBER = '+15551110000';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('down'),
    } as Response);

    const result = await dispatchSmsOtp({
      phoneNumber: '+15550000000',
      code: '999999',
      purpose: 'SIGNUP_OTP',
    });

    expect(result.delivered).toBe(false);
    expect(result.provider).toBe('TWILIO');
    expect(result.failureReason).toContain('status 503');
  });
});
