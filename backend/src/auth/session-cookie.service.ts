import { Injectable } from '@nestjs/common';
import type { Response } from 'express';

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
  /**
   * IMPORTANT: This name must match what the Next middleware expects.
   * Frontend middleware currently checks `request.cookies.get('token')`.
   */
  private readonly cookieName = 'token';

  private isProd(): boolean {
    return (process.env.NODE_ENV || 'development') === 'production';
  }

  private getMaxAgeMs(): number {
    // Keep cookie expiration aligned with JWT expiration
    const expSecondsRaw = process.env.JWT_EXPIRATION || '86400';
    const expSeconds = Number.parseInt(expSecondsRaw, 10);
    const safeSeconds = Number.isFinite(expSeconds) && expSeconds > 0 ? expSeconds : 86400;
    return safeSeconds * 1000;
  }

  /**
   * Set the access token cookie (HttpOnly).
   * In production this should be Secure (HTTPS). In local dev it's typically HTTP.
   */
  setTokenCookie(res: Response, token: string): void {
    if (!token) {
      // Defensive: never set an empty cookie
      if (!this.isProd()) console.warn('[SessionCookieService] setTokenCookie called with empty token');
      return;
    }

    const secure = this.isProd();

    res.cookie(this.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: this.getMaxAgeMs(),
    });

    if (!this.isProd()) {
      console.log('[SessionCookieService] token cookie set', { httpOnly: true, sameSite: 'lax', secure });
    }
  }

  /**
   * Clear the access token cookie.
   */
  clearTokenCookie(res: Response): void {
    const secure = this.isProd();

    res.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
    });

    if (!this.isProd()) {
      console.log('[SessionCookieService] token cookie cleared', { secure });
    }
  }
}

