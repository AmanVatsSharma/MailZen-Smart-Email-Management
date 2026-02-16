import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../logging/structured-log.util';

type SmsDispatchPurpose = 'SIGNUP_OTP' | 'PHONE_VERIFY_OTP';
type SmsProvider = 'CONSOLE' | 'WEBHOOK' | 'TWILIO' | 'DISABLED';
type ActiveSmsProvider = Exclude<SmsProvider, 'DISABLED'>;
const smsLogger = new Logger('SmsDispatcher');

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

function normalizeSmsProvider(
  rawValue: string | undefined,
  fallbackProvider: SmsProvider,
): SmsProvider {
  const normalized = String(rawValue || '')
    .trim()
    .toUpperCase();
  if (normalized === 'WEBHOOK') return 'WEBHOOK';
  if (normalized === 'TWILIO') return 'TWILIO';
  if (normalized === 'DISABLED') return 'DISABLED';
  if (normalized === 'CONSOLE') return 'CONSOLE';
  return fallbackProvider;
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
  const signingKey = String(
    process.env.MAILZEN_SMS_WEBHOOK_SIGNING_KEY || '',
  ).trim();
  const timestamp = String(Date.now());
  const payloadJson = JSON.stringify({
    phoneNumber: input.phoneNumber,
    code: input.code,
    purpose: input.purpose,
  });
  if (signingKey) {
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(`${timestamp}.${payloadJson}`)
      .digest('hex');
    headers['x-mailzen-sms-timestamp'] = timestamp;
    headers['x-mailzen-sms-signature'] = signature;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payloadJson,
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
  smsLogger.log(
    serializeStructuredLog({
      event: 'sms_dispatch_console_delivered',
      purpose: input.purpose,
      phoneFingerprint: fingerprintIdentifier(input.phoneNumber),
    }),
  );
  return {
    delivered: true,
    provider: 'CONSOLE',
  };
}

async function dispatchViaProvider(input: {
  provider: SmsProvider;
  payload: SmsDispatchInput;
}): Promise<SmsDispatchResult> {
  if (input.provider === 'WEBHOOK') {
    return dispatchViaWebhook(input.payload);
  }
  if (input.provider === 'TWILIO') {
    return dispatchViaTwilio(input.payload);
  }
  if (input.provider === 'DISABLED') {
    return {
      delivered: false,
      provider: 'DISABLED',
      failureReason: 'SMS provider disabled by configuration',
    };
  }
  return dispatchViaConsole(input.payload);
}

export async function dispatchSmsOtp(
  input: SmsDispatchInput,
): Promise<SmsDispatchResult> {
  const provider = normalizeSmsProvider(
    process.env.MAILZEN_SMS_PROVIDER,
    'CONSOLE',
  );
  const fallbackRaw = String(process.env.MAILZEN_SMS_FALLBACK_PROVIDER || '')
    .trim()
    .toUpperCase();
  const fallbackProvider: ActiveSmsProvider | null = [
    'CONSOLE',
    'WEBHOOK',
    'TWILIO',
  ].includes(fallbackRaw)
    ? (fallbackRaw as ActiveSmsProvider)
    : null;
  const strictByDefault =
    (process.env.NODE_ENV || 'development') === 'production';
  const strictDelivery = resolveBoolean(
    process.env.MAILZEN_SMS_STRICT_DELIVERY,
    strictByDefault,
  );
  if (provider === 'DISABLED') {
    return {
      delivered: false,
      provider: 'DISABLED',
      failureReason: 'SMS provider disabled by configuration',
    };
  }
  const activeProvider = provider as ActiveSmsProvider;
  const providerChain: ActiveSmsProvider[] = [activeProvider];
  if (fallbackProvider && fallbackProvider !== activeProvider) {
    providerChain.push(fallbackProvider);
  }
  let lastErrorMessage = 'SMS delivery provider failed';
  let lastProvider: ActiveSmsProvider = activeProvider;

  for (let index = 0; index < providerChain.length; index += 1) {
    const activeProvider = providerChain[index];
    lastProvider = activeProvider;
    try {
      return await dispatchViaProvider({
        provider: activeProvider,
        payload: input,
      });
    } catch (error: unknown) {
      lastErrorMessage = error instanceof Error ? error.message : String(error);
      const hasFallback = index < providerChain.length - 1;
      if (hasFallback) {
        const nextProvider = providerChain[index + 1];
        smsLogger.warn(
          serializeStructuredLog({
            event: 'sms_dispatch_provider_fallback_attempt',
            provider: activeProvider,
            nextProvider,
            reason: lastErrorMessage,
            purpose: input.purpose,
            phoneFingerprint: fingerprintIdentifier(input.phoneNumber),
          }),
        );
      }
    }
  }
  if (strictDelivery) {
    throw new Error(`SMS delivery failed: ${lastErrorMessage}`);
  }
  smsLogger.warn(
    serializeStructuredLog({
      event: 'sms_dispatch_non_strict_failure',
      provider: lastProvider,
      reason: lastErrorMessage,
      purpose: input.purpose,
      phoneFingerprint: fingerprintIdentifier(input.phoneNumber),
    }),
  );
  return {
    delivered: false,
    provider: lastProvider,
    failureReason: lastErrorMessage,
  };
}
