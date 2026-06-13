// apps/backend/src/shared/config/env.config.ts
// Typed env config. Read once at boot; fail loud if required vars are missing.

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  typeormSynchronize: boolean;
  redis: { host: string; port: number };
  jwt: { accessSecret: string; accessTtl: string; refreshTtl: string };
  google: { clientId: string; clientSecret: string; loginRedirect: string; providerRedirect: string };
  outlook: { clientId: string; clientSecret: string; providerRedirect: string };
  providerSecrets: { keyring: string; activeKeyId: string };
  smsProvider: 'CONSOLE' | 'WEBHOOK' | 'TWILIO' | 'DISABLED';
  sentryDsn?: string;
  sentryAuthToken?: string;
  automationLoopThreshold: number;
  rateLimit: { ttl: number; max: number };
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v !== '' ? v : undefined;
}

export function envConfig(): AppConfig {
  return {
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
    port: Number(process.env.PORT ?? 4000),
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql:///mailzen?host=/var/run/postgresql',
    typeormSynchronize: (process.env.TYPEORM_SYNCHRONIZE ?? 'true') === 'true' && process.env.CI !== 'true',
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
    jwt: {
      accessSecret: required('JWT_SECRET', 'dev-only-secret-do-not-use-in-prod'),
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    },
    google: {
      clientId: required('GOOGLE_CLIENT_ID', 'dev-google-client-id'),
      clientSecret: required('GOOGLE_CLIENT_SECRET', 'dev-google-client-secret'),
      loginRedirect: required('GOOGLE_REDIRECT_URI', 'http://localhost:4000/auth/google/callback'),
      providerRedirect: required('GOOGLE_PROVIDER_REDIRECT_URI', 'http://localhost:4000/email-integration/google/callback'),
    },
    outlook: {
      clientId: required('OUTLOOK_CLIENT_ID', 'dev-outlook-client-id'),
      clientSecret: required('OUTLOOK_CLIENT_SECRET', 'dev-outlook-client-secret'),
      providerRedirect: required('OUTLOOK_PROVIDER_REDIRECT_URI', 'http://localhost:4000/email-integration/microsoft/callback'),
    },
    providerSecrets: {
      keyring: process.env.PROVIDER_SECRETS_KEYRING ?? 'dev-keyring',
      activeKeyId: process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID ?? 'k1',
    },
    smsProvider: (process.env.MAILZEN_SMS_PROVIDER as AppConfig['smsProvider']) ?? 'CONSOLE',
    sentryDsn: optional('SENTRY_DSN'),
    sentryAuthToken: optional('SENTRY_AUTH_TOKEN'),
    automationLoopThreshold: Number(process.env.AUTOMATION_LOOP_THRESHOLD ?? 10),
    rateLimit: {
      ttl: Number(process.env.RATE_LIMIT_TTL ?? 60),
      max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    },
  };
}
