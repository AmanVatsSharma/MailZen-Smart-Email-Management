type SmsDispatchPurpose = 'SIGNUP_OTP' | 'PHONE_VERIFY_OTP';

export type SmsDispatchInput = {
  phoneNumber: string;
  code: string;
  purpose: SmsDispatchPurpose;
};

export type SmsDispatchResult = {
  delivered: boolean;
  provider: string;
  failureReason?: string;
};

function resolveInteger(input: {
  rawValue?: string;
  fallbackValue: number;
  minimumValue: number;
  maximumValue: number;
}): number {
  const parsedValue = Number(input.rawValue);
  const candidate = Number.isFinite(parsedValue)
    ? Math.floor(parsedValue)
    : input.fallbackValue;
  if (candidate < input.minimumValue) return input.minimumValue;
  if (candidate > input.maximumValue) return input.maximumValue;
  return candidate;
}

function resolveBoolean(rawValue: string | undefined, fallbackValue: boolean) {
  if (typeof rawValue !== 'string') return fallbackValue;
  const normalized = rawValue.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallbackValue;
}

async function dispatchViaWebhook(
  input: SmsDispatchInput,
): Promise<SmsDispatchResult> {
  const webhookUrl = String(process.env.MAILZEN_SMS_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    throw new Error(
      'MAILZEN_SMS_WEBHOOK_URL is required when MAILZEN_SMS_PROVIDER=WEBHOOK',
    );
  }
  const timeoutMs = resolveInteger({
    rawValue: process.env.MAILZEN_SMS_WEBHOOK_TIMEOUT_MS,
    fallbackValue: 5000,
    minimumValue: 1000,
    maximumValue: 30000,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const token = String(process.env.MAILZEN_SMS_WEBHOOK_TOKEN || '').trim();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phoneNumber: input.phoneNumber,
        code: input.code,
        purpose: input.purpose,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`SMS webhook responded with status ${response.status}`);
    }
    return {
      delivered: true,
      provider: 'WEBHOOK',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function dispatchViaTwilio(
  input: SmsDispatchInput,
): Promise<SmsDispatchResult> {
  const accountSid = String(
    process.env.MAILZEN_SMS_TWILIO_ACCOUNT_SID || '',
  ).trim();
  const authToken = String(
    process.env.MAILZEN_SMS_TWILIO_AUTH_TOKEN || '',
  ).trim();
  const fromNumber = String(
    process.env.MAILZEN_SMS_TWILIO_FROM_NUMBER || '',
  ).trim();
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'MAILZEN_SMS_TWILIO_ACCOUNT_SID, MAILZEN_SMS_TWILIO_AUTH_TOKEN, and MAILZEN_SMS_TWILIO_FROM_NUMBER are required when MAILZEN_SMS_PROVIDER=TWILIO',
    );
  }
  const baseUrl = String(
    process.env.MAILZEN_SMS_TWILIO_API_BASE_URL || 'https://api.twilio.com',
  )
    .trim()
    .replace(/\/+$/, '');
  const timeoutMs = resolveInteger({
    rawValue: process.env.MAILZEN_SMS_TWILIO_TIMEOUT_MS,
    fallbackValue: 5000,
    minimumValue: 1000,
    maximumValue: 30000,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = `${baseUrl}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const statusCallbackUrl = String(
    process.env.MAILZEN_SMS_TWILIO_STATUS_CALLBACK_URL || '',
  ).trim();
  const body = new URLSearchParams({
    To: input.phoneNumber,
    From: fromNumber,
    Body: `MailZen verification code (${input.purpose}): ${input.code}`,
  });
  if (statusCallbackUrl) {
    body.set('StatusCallback', statusCallbackUrl);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: controller.signal,
    });
    if (!response.ok) {
      const failurePayload = (await response.text()).slice(0, 200);
      throw new Error(
        `Twilio SMS responded with status ${response.status} payload=${failurePayload}`,
      );
    }
    return {
      delivered: true,
      provider: 'TWILIO',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function dispatchViaConsole(input: SmsDispatchInput): SmsDispatchResult {
  console.log(
    `[SmsDispatcher] OTP (${input.purpose}) for ${input.phoneNumber}: ${input.code}`,
  );
  return {
    delivered: true,
    provider: 'CONSOLE',
  };
}

export async function dispatchSmsOtp(
  input: SmsDispatchInput,
): Promise<SmsDispatchResult> {
  const provider = String(process.env.MAILZEN_SMS_PROVIDER || 'CONSOLE')
    .trim()
    .toUpperCase();
  const strictByDefault =
    (process.env.NODE_ENV || 'development') === 'production';
  const strictDelivery = resolveBoolean(
    process.env.MAILZEN_SMS_STRICT_DELIVERY,
    strictByDefault,
  );

  try {
    if (provider === 'WEBHOOK') {
      return await dispatchViaWebhook(input);
    }
    if (provider === 'TWILIO') {
      return await dispatchViaTwilio(input);
    }
    if (provider === 'DISABLED') {
      return {
        delivered: false,
        provider: 'DISABLED',
        failureReason: 'SMS provider disabled by configuration',
      };
    }
    return dispatchViaConsole(input);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (strictDelivery) {
      throw new Error(`SMS delivery failed: ${errorMessage}`);
    }
    console.warn(
      `[SmsDispatcher] Non-strict delivery failure: ${errorMessage}`,
    );
    return {
      delivered: false,
      provider,
      failureReason: errorMessage,
    };
  }
}
