import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RequestRateLimiter } from '../common/rate-limit/request-rate-limiter';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

type AuthRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

type AuthAbuseOperation =
  | 'login'
  | 'refresh'
  | 'logout'
  | 'register'
  | 'phone_send_otp'
  | 'phone_verify_otp'
  | 'signup_send_otp'
  | 'signup_verify'
  | 'forgot_password'
  | 'reset_password';

@Injectable()
export class AuthAbuseProtectionService {
  private readonly logger = new Logger(AuthAbuseProtectionService.name);
  private readonly loginLimiter = new RequestRateLimiter({
    windowMs: this.resolvePositiveInteger(
      process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
      60_000,
      1_000,
      60 * 60 * 1_000,
    ),
    maxRequests: this.resolvePositiveInteger(
      process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS,
      10,
      1,
      5_000,
    ),
  });
  private readonly registerLimiter = new RequestRateLimiter({
    windowMs: this.resolvePositiveInteger(
      process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS,
      5 * 60_000,
      1_000,
      24 * 60 * 60 * 1_000,
    ),
    maxRequests: this.resolvePositiveInteger(
      process.env.AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS,
      5,
      1,
      5_000,
    ),
  });
  private readonly refreshLimiter = new RequestRateLimiter({
    windowMs: this.resolvePositiveInteger(
      process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS,
      60_000,
      1_000,
      60 * 60 * 1_000,
    ),
    maxRequests: this.resolvePositiveInteger(
      process.env.AUTH_REFRESH_RATE_LIMIT_MAX_REQUESTS,
      20,
      1,
      5_000,
    ),
  });
  private readonly otpLimiter = new RequestRateLimiter({
    windowMs: this.resolvePositiveInteger(
      process.env.AUTH_OTP_RATE_LIMIT_WINDOW_MS,
      5 * 60_000,
      1_000,
      24 * 60 * 60 * 1_000,
    ),
    maxRequests: this.resolvePositiveInteger(
      process.env.AUTH_OTP_RATE_LIMIT_MAX_REQUESTS,
      6,
      1,
      5_000,
    ),
  });
  private readonly passwordResetLimiter = new RequestRateLimiter({
    windowMs: this.resolvePositiveInteger(
      process.env.AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
      10 * 60_000,
      1_000,
      24 * 60 * 60 * 1_000,
    ),
    maxRequests: this.resolvePositiveInteger(
      process.env.AUTH_PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS,
      6,
      1,
      5_000,
    ),
  });

  enforceLimit(input: {
    operation: AuthAbuseOperation;
    request?: AuthRequestLike;
    identifier?: string;
  }): void {
    if (!this.isProtectionEnabled()) return;
    const limiter = this.resolveLimiter(input.operation);
    const clientIdentifier = this.resolveClientIdentifier(input.request);
    const scopedIdentifier = this.normalizeIdentifier(input.identifier);
    const key = scopedIdentifier
      ? `${input.operation}:${clientIdentifier}:${scopedIdentifier}`
      : `${input.operation}:${clientIdentifier}`;
    const result = limiter.consume(key);
    if (result.allowed) return;

    this.logger.warn(
      serializeStructuredLog({
        event: 'auth_abuse_limit_exceeded',
        operation: input.operation,
        retryAfterSeconds: result.retryAfterSeconds,
        requestCount: result.count,
        scopedIdentifierFingerprint: scopedIdentifier
          ? fingerprintIdentifier(scopedIdentifier)
          : null,
        clientFingerprint: fingerprintIdentifier(clientIdentifier),
      }),
    );
    throw new HttpException(
      `Too many ${input.operation.replace(/_/g, ' ')} attempts. Please retry later.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private isProtectionEnabled(): boolean {
    const normalized = String(
      process.env.AUTH_ABUSE_PROTECTION_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  private resolveLimiter(operation: AuthAbuseOperation): RequestRateLimiter {
    if (operation === 'login') return this.loginLimiter;
    if (operation === 'refresh' || operation === 'logout') {
      return this.refreshLimiter;
    }
    if (operation === 'register') return this.registerLimiter;
    if (
      operation === 'signup_send_otp' ||
      operation === 'signup_verify' ||
      operation === 'phone_send_otp' ||
      operation === 'phone_verify_otp'
    ) {
      return this.otpLimiter;
    }
    return this.passwordResetLimiter;
  }

  private normalizeIdentifier(identifier?: string): string {
    return String(identifier || '')
      .trim()
      .toLowerCase();
  }

  private resolveClientIdentifier(request?: AuthRequestLike): string {
    if (!request) return 'ip:unknown';
    const header = request.headers?.['x-forwarded-for'];
    const forwardedFor = Array.isArray(header) ? header[0] : header;
    if (forwardedFor) {
      const [firstIp] = forwardedFor.split(',');
      const normalizedIp = String(firstIp || '').trim();
      if (normalizedIp) return `ip:${normalizedIp}`;
    }
    return `ip:${String(request.ip || 'unknown').trim() || 'unknown'}`;
  }

  private resolvePositiveInteger(
    rawValue: string | undefined,
    fallbackValue: number,
    minimumValue: number,
    maximumValue: number,
  ): number {
    const parsedValue = Number(rawValue);
    const candidate = Number.isFinite(parsedValue)
      ? Math.floor(parsedValue)
      : fallbackValue;
    if (candidate < minimumValue) return minimumValue;
    if (candidate > maximumValue) return maximumValue;
    return candidate;
  }
}
