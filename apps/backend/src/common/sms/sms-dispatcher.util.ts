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
