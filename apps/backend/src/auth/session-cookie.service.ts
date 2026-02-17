import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

/**
 * Centralized session cookie management.
 *
 * Why:
 * - Keeps cookie flags consistent (HttpOnly/SameSite/Secure/Path)
 * - Makes it easy to swap auth providers later (e.g., Cognito) without touching resolvers
 * - Improves auditability and debugging (single place for logs)
 */
@Injectable()
export class SessionCookieService {
  private readonly cookieName = this.resolveCookieName();

  private readonly logger = new Logger(SessionCookieService.name);

  private isProd(): boolean {
    return (process.env.NODE_ENV || 'development') === 'production';
  }

  private getMaxAgeMs(): number {
    // Keep cookie expiration aligned with JWT expiration
    const expSecondsRaw = process.env.JWT_EXPIRATION || '86400';
    const expSeconds = Number.parseInt(expSecondsRaw, 10);
    const safeSeconds =
      Number.isFinite(expSeconds) && expSeconds > 0 ? expSeconds : 86400;
    return safeSeconds * 1000;
  }

  private resolveCookieName(): string {
    const normalized = String(process.env.MAILZEN_SESSION_COOKIE_NAME || '')
      .trim()
      .toLowerCase();
    if (!normalized) return 'token';
    return normalized;
  }

  private resolveCookieSameSite(): 'lax' | 'strict' | 'none' {
    const normalized = String(process.env.MAILZEN_SESSION_COOKIE_SAMESITE || '')
      .trim()
      .toLowerCase();
    if (normalized === 'strict') return 'strict';
    if (normalized === 'none') return 'none';
    return 'lax';
  }

  private resolveCookieSecure(sameSite: 'lax' | 'strict' | 'none'): boolean {
    const override = String(process.env.MAILZEN_SESSION_COOKIE_SECURE || '')
      .trim()
      .toLowerCase();
    const secureByOverride = ['true', '1', 'yes', 'on'].includes(override)
      ? true
      : ['false', '0', 'no', 'off'].includes(override)
        ? false
        : this.isProd();
    if (sameSite === 'none' && !secureByOverride) return true;
    return secureByOverride;
  }

  private resolveCookieDomain(): string | undefined {
    const normalized = String(process.env.MAILZEN_SESSION_COOKIE_DOMAIN || '')
      .trim()
      .toLowerCase();
    if (!normalized) return undefined;
    return normalized;
  }

  private resolveCookiePath(): string {
    const normalized = String(process.env.MAILZEN_SESSION_COOKIE_PATH || '/')
      .trim()
      .toLowerCase();
    if (!normalized) return '/';
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  /**
   * Set the access token cookie (HttpOnly).
   * In production this should be Secure (HTTPS). In local dev it's typically HTTP.
   */
  setTokenCookie(res: Response, token: string): void {
    if (!token) {
      // Defensive: never set an empty cookie
      this.logger.warn(
        serializeStructuredLog({
          event: 'session_cookie_set_skipped',
          reason: 'empty-token',
        }),
      );
      return;
    }

    const sameSite = this.resolveCookieSameSite();
    const secure = this.resolveCookieSecure(sameSite);
    const domain = this.resolveCookieDomain();
    const path = this.resolveCookiePath();

    res.cookie(this.cookieName, token, {
      httpOnly: true,
      sameSite,
      secure,
      domain,
      path,
      maxAge: this.getMaxAgeMs(),
    });

    this.logger.log(
      serializeStructuredLog({
        event: 'session_cookie_set',
        httpOnly: true,
        sameSite,
        secure,
        hasDomain: Boolean(domain),
        path,
      }),
    );
  }

  /**
   * Clear the access token cookie.
   */
  clearTokenCookie(res: Response): void {
    const sameSite = this.resolveCookieSameSite();
    const secure = this.resolveCookieSecure(sameSite);
    const domain = this.resolveCookieDomain();
    const path = this.resolveCookiePath();

    res.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite,
      secure,
      domain,
      path,
    });

    this.logger.log(
      serializeStructuredLog({
        event: 'session_cookie_cleared',
        httpOnly: true,
        sameSite,
        secure,
        hasDomain: Boolean(domain),
        path,
      }),
    );
  }
}
