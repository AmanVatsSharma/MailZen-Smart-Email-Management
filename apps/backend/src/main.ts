import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from './common/logging/structured-log.util';
import { createHttpAuthCallbackRateLimitMiddleware } from './common/rate-limit/http-auth-callback-rate-limit.middleware';
import { createHttpRateLimitMiddleware } from './common/rate-limit/http-rate-limit.middleware';
import { createHttpCsrfOriginProtectionMiddleware } from './common/security/http-csrf-origin.middleware';
import { createHttpSecurityHeadersMiddleware } from './common/security/http-security-headers.middleware';

const bootstrapLogger = new Logger('Bootstrap');

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntegerEnv(
  value: string | undefined,
  fallback: number,
  minimum = 1,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = Number(value);
  const candidate = Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
  if (candidate < minimum) return minimum;
  if (candidate > maximum) return maximum;
  return candidate;
}

function parseCsvEnv(value: string | undefined, fallback: string[]): string[] {
  const source = value === undefined ? fallback.join(',') : value;
  return source
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseSecurityHeaderEnum<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  for (const allowedValue of allowedValues) {
    if (allowedValue.toLowerCase() === normalized) return allowedValue;
  }
  return fallback;
}

async function assertAgentPlatformReadiness(): Promise<void> {
  const shouldCheck = parseBooleanEnv(
    process.env.AI_AGENT_PLATFORM_CHECK_ON_STARTUP,
    true,
  );
  if (!shouldCheck) return;

  const platformUrl =
    process.env.AI_AGENT_PLATFORM_URL || 'http://localhost:8100';
  const healthUrl = `${platformUrl}/health`;
  const required = parseBooleanEnv(
    process.env.AI_AGENT_PLATFORM_REQUIRED,
    false,
  );
  const timeoutMs = Number(process.env.AI_AGENT_PLATFORM_TIMEOUT_MS || 4000);

  try {
    await axios.get(healthUrl, {
      timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 4000,
      headers: {
        'x-request-id': `backend-startup-${randomUUID()}`,
        ...(process.env.AI_AGENT_PLATFORM_KEY
          ? { 'x-agent-platform-key': process.env.AI_AGENT_PLATFORM_KEY }
          : {}),
      },
    });
    bootstrapLogger.log(`AI platform reachable during startup at ${healthUrl}`);
  } catch (error) {
    const message = `AI platform readiness check failed at ${healthUrl}: ${String(
      error,
    )}`;
    if (required) throw new Error(message);
    bootstrapLogger.warn(message);
  }
}

async function bootstrap() {
  // Fail fast on unsafe/missing configuration (enterprise-grade default).
  // Keeping this here avoids scattered runtime failures later.
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length < 32) {
    // 32+ chars is a practical minimum; adjust as needed.
    throw new Error(
      'JWT_SECRET is missing/too short. Set a strong JWT_SECRET (>= 32 chars) in apps/backend/.env',
    );
  }

  await assertAgentPlatformReadiness();

  const app = await NestFactory.create(AppModule);

  const securityHeadersEnabled = parseBooleanEnv(
    process.env.GLOBAL_SECURITY_HEADERS_ENABLED,
    true,
  );
  const securityHeadersContentTypeNosniffEnabled = parseBooleanEnv(
    process.env.GLOBAL_SECURITY_HEADERS_CONTENT_TYPE_NOSNIFF_ENABLED,
    true,
  );
  const securityHeadersFrameOptions = parseSecurityHeaderEnum(
    process.env.GLOBAL_SECURITY_HEADERS_FRAME_OPTIONS,
    ['DENY', 'SAMEORIGIN'] as const,
    'DENY',
  );
  const securityHeadersReferrerPolicy = String(
    process.env.GLOBAL_SECURITY_HEADERS_REFERRER_POLICY ||
      'strict-origin-when-cross-origin',
  )
    .trim()
    .toLowerCase();
  const securityHeadersPermissionsPolicy = String(
    process.env.GLOBAL_SECURITY_HEADERS_PERMISSIONS_POLICY ||
      'camera=(), microphone=(), geolocation=()',
  ).trim();
  const securityHeadersCrossOriginOpenerPolicy = parseSecurityHeaderEnum(
    process.env.GLOBAL_SECURITY_HEADERS_COOP,
    ['same-origin', 'same-origin-allow-popups', 'unsafe-none'] as const,
    'same-origin',
  );
  const securityHeadersHstsEnabled = parseBooleanEnv(
    process.env.GLOBAL_SECURITY_HEADERS_HSTS_ENABLED,
    (process.env.NODE_ENV || 'development') === 'production',
  );
  const securityHeadersHstsMaxAgeSeconds = parsePositiveIntegerEnv(
    process.env.GLOBAL_SECURITY_HEADERS_HSTS_MAX_AGE_SECONDS,
    31536000,
    60,
    63072000,
  );
  const securityHeadersHstsIncludeSubdomains = parseBooleanEnv(
    process.env.GLOBAL_SECURITY_HEADERS_HSTS_INCLUDE_SUBDOMAINS,
    true,
  );
  const securityHeadersHstsPreload = parseBooleanEnv(
    process.env.GLOBAL_SECURITY_HEADERS_HSTS_PRELOAD,
    false,
  );
  app.use(
    createHttpSecurityHeadersMiddleware({
      enabled: securityHeadersEnabled,
      contentTypeNosniffEnabled: securityHeadersContentTypeNosniffEnabled,
      frameOptions: securityHeadersFrameOptions,
      referrerPolicy: securityHeadersReferrerPolicy,
      permissionsPolicy: securityHeadersPermissionsPolicy,
      crossOriginOpenerPolicy: securityHeadersCrossOriginOpenerPolicy,
      hstsEnabled: securityHeadersHstsEnabled,
      hstsMaxAgeSeconds: securityHeadersHstsMaxAgeSeconds,
      hstsIncludeSubdomains: securityHeadersHstsIncludeSubdomains,
      hstsPreload: securityHeadersHstsPreload,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incomingRequestIdHeader = req.headers['x-request-id'];
    const requestId = resolveCorrelationId(incomingRequestIdHeader);

    res.setHeader('x-request-id', requestId);

    const requestStartedAt = Date.now();
    const requestPath = String(req.originalUrl || req.url || '/').split('?')[0];
    bootstrapLogger.log(
      serializeStructuredLog({
        event: 'http_request_start',
        requestId,
        method: req.method,
        path: requestPath || '/',
        query: req.query as Record<string, unknown>,
      }),
    );

    res.on('finish', () => {
      bootstrapLogger.log(
        serializeStructuredLog({
          event: 'http_request_complete',
          requestId,
          method: req.method,
          path: requestPath || '/',
          statusCode: res.statusCode,
          durationMs: Date.now() - requestStartedAt,
        }),
      );
    });

    next();
  });

  const rateLimitEnabled = parseBooleanEnv(
    process.env.GLOBAL_RATE_LIMIT_ENABLED,
    true,
  );
  const csrfProtectionEnabled = parseBooleanEnv(
    process.env.GLOBAL_CSRF_PROTECTION_ENABLED,
    true,
  );
  const csrfTrustedOrigins = parseCsvEnv(
    process.env.GLOBAL_CSRF_TRUSTED_ORIGINS,
    [process.env.FRONTEND_URL || 'http://localhost:3000'],
  );
  const csrfExcludedPaths = parseCsvEnv(
    process.env.GLOBAL_CSRF_EXCLUDED_PATHS,
    [],
  );
  const sessionCookieName = String(
    process.env.MAILZEN_SESSION_COOKIE_NAME || 'token',
  )
    .trim()
    .toLowerCase();
  const csrfEnforcedMethods = parseCsvEnv(
    process.env.GLOBAL_CSRF_ENFORCED_METHODS,
    ['POST', 'PUT', 'PATCH', 'DELETE'],
  );
  app.use(
    createHttpCsrfOriginProtectionMiddleware(
      {
        enabled: csrfProtectionEnabled,
        trustedOrigins: csrfTrustedOrigins,
        excludedPaths: csrfExcludedPaths,
        enforceMethods: csrfEnforcedMethods,
        sessionCookieName: sessionCookieName || 'token',
      },
      bootstrapLogger,
    ),
  );

  const authCallbackRateLimitEnabled = parseBooleanEnv(
    process.env.AUTH_CALLBACK_RATE_LIMIT_ENABLED,
    true,
  );
  const authCallbackRateLimitWindowMs = parsePositiveIntegerEnv(
    process.env.AUTH_CALLBACK_RATE_LIMIT_WINDOW_MS,
    60_000,
    1_000,
    60 * 60 * 1_000,
  );
  const authCallbackRateLimitMaxRequests = parsePositiveIntegerEnv(
    process.env.AUTH_CALLBACK_RATE_LIMIT_MAX_REQUESTS,
    40,
    1,
    5_000,
  );
  const authCallbackRateLimitPaths = parseCsvEnv(
    process.env.AUTH_CALLBACK_RATE_LIMIT_PATHS,
    [
      '/auth/google/callback',
      '/auth/microsoft/callback',
      '/email-integration/google/callback',
      '/email-integration/microsoft/callback',
    ],
  );
  app.use(
    createHttpAuthCallbackRateLimitMiddleware(
      {
        enabled: authCallbackRateLimitEnabled,
        windowMs: authCallbackRateLimitWindowMs,
        maxRequests: authCallbackRateLimitMaxRequests,
        callbackPaths: authCallbackRateLimitPaths,
      },
      bootstrapLogger,
    ),
  );

  const rateLimitWindowMs = parsePositiveIntegerEnv(
    process.env.GLOBAL_RATE_LIMIT_WINDOW_MS,
    60_000,
    1_000,
    60 * 60 * 1_000,
  );
  const rateLimitMaxRequests = parsePositiveIntegerEnv(
    process.env.GLOBAL_RATE_LIMIT_MAX_REQUESTS,
    300,
    1,
    50_000,
  );
  const rateLimitExcludedPaths = parseCsvEnv(
    process.env.GLOBAL_RATE_LIMIT_EXCLUDED_PATHS,
    ['/auth/google/callback', '/auth/microsoft/callback'],
  );
  app.use(
    createHttpRateLimitMiddleware(
      {
        enabled: rateLimitEnabled,
        windowMs: rateLimitWindowMs,
        maxRequests: rateLimitMaxRequests,
        excludedPaths: rateLimitExcludedPaths,
      },
      bootstrapLogger,
    ),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Configure CORS to allow requests from the frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });

  await app.listen(process.env.PORT || 4000);
}
void bootstrap();
