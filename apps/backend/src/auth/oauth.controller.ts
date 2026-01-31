import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { buildOAuthState, verifyOAuthState } from './oauth-state.util';

/**
 * Google OAuth login (code flow).
 *
 * This is intentionally implemented as REST endpoints:
 * - Redirect-based OAuth flows are clunky over GraphQL.
 * - Frontend can simply link to `/auth/google/start`.
 */
@Controller('auth/google')
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);
  private readonly oauthClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      // Fail fast on boot in dev; in prod this should be configured.
      this.logger.error('Missing Google OAuth env vars: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI');
    }
    this.oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  @Get('start')
  async start(
    @Res() res: Response,
    @Query('redirect') redirect?: string,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return res.status(500).send('Google OAuth not configured');
    }

    // Scope default: identity (openid/email/profile). You can expand with Gmail scopes if desired.
    // We keep this env-configurable for easy iteration without code changes.
    const scope = process.env.GOOGLE_OAUTH_SCOPES || 'openid email profile';
    const state = buildOAuthState(redirect);

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scope);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    // Helpful for debugging the redirect URL without leaking tokens.
    this.logger.log(`OAuth start redirecting to Google (scopes=${scope})`);
    return res.redirect(url.toString());
  }

  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('mode') mode?: 'json' | 'redirect',
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const outMode = mode || 'redirect';

    if (error) {
      this.logger.warn(`Google OAuth callback error from provider: ${error}`);
      await this.prisma.auditLog.create({ data: { action: 'OAUTH_GOOGLE_FAILED', metadata: { error } as any } });
      if (outMode === 'json') return res.status(401).json({ ok: false, error });
      return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      this.logger.warn('Google OAuth callback missing code/state');
      await this.prisma.auditLog.create({ data: { action: 'OAUTH_GOOGLE_FAILED', metadata: { reason: 'missing_code_or_state' } as any } });
      if (outMode === 'json') return res.status(400).json({ ok: false, error: 'Missing code/state' });
      return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('Missing code/state')}`);
    }

    let redirectOverride: string | undefined;
    try {
      const payload = verifyOAuthState(state, 10 * 60 * 1000);
      redirectOverride = payload.redirect;
    } catch (e: any) {
      this.logger.warn(`Google OAuth state validation failed: ${e?.message || e}`);
      await this.prisma.auditLog.create({ data: { action: 'OAUTH_GOOGLE_FAILED', metadata: { reason: 'invalid_state' } as any } });
      if (outMode === 'json') return res.status(401).json({ ok: false, error: 'Invalid state' });
      return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('Invalid state')}`);
    }

    try {
      // Exchange code for tokens.
      const { tokens } = await this.oauthClient.getToken(code);
      if (!tokens.id_token) {
        throw new Error('Google did not return id_token (ensure openid scope is included)');
      }

      // Verify id_token and extract user identity (no extra HTTP call required).
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.sub) {
        throw new Error('Google id_token missing email/sub');
      }

      const email = payload.email.toLowerCase();
      const googleSub = payload.sub;
      const name = payload.name || payload.given_name || null;
      const emailVerified = !!payload.email_verified;

      // Upsert user:
      // - Prefer matching by googleSub (stable)
      // - Fall back to email (common case for first-time linkage)
      const existingBySub = await this.prisma.user.findFirst({ where: { googleSub } as any });
      const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
      const user = existingBySub || existingByEmail;

      let dbUser;
      if (!user) {
        dbUser = await this.prisma.user.create({
          data: {
            email,
            password: null,
            name,
            isEmailVerified: emailVerified,
            googleSub,
          } as any,
        });
        this.logger.log(`Created new user via Google OAuth: ${email}`);
      } else {
        // Guard against accidental account takeover: if email matches but googleSub differs, reject.
        if ((user as any).googleSub && (user as any).googleSub !== googleSub) {
          throw new Error('This email is already linked to a different Google account');
        }
        dbUser = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            name: user.name || name,
            googleSub,
            isEmailVerified: user.isEmailVerified || emailVerified,
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockoutUntil: null,
          } as any,
        });
        this.logger.log(`Linked/updated user via Google OAuth: ${email}`);
      }

      await this.prisma.auditLog.create({
        data: { action: 'OAUTH_GOOGLE_SUCCESS', userId: dbUser.id, metadata: { email } as any },
      });

      const { accessToken } = this.authService.login(dbUser);
      const refreshToken = await this.authService.generateRefreshToken(dbUser.id, req.headers['user-agent'], req.ip);

      const finalRedirect = redirectOverride || `${frontendUrl}/auth/oauth-success`;

      if (outMode === 'json') {
        return res.json({
          ok: true,
          token: accessToken,
          refreshToken,
          user: { id: dbUser.id, email: dbUser.email, name: dbUser.name },
        });
      }

      // WARNING: putting tokens in query params is not ideal (they can appear in logs/history).
      // This matches the current frontend pattern (localStorage) and is a practical MVP.
      // In a hardening pass, switch to HttpOnly cookies.
      const url = new URL(finalRedirect);
      url.searchParams.set('token', accessToken);
      url.searchParams.set('refreshToken', refreshToken);
      return res.redirect(url.toString());
    } catch (e: any) {
      this.logger.error(`Google OAuth login failed: ${e?.message || e}`, e?.stack);
      await this.prisma.auditLog.create({ data: { action: 'OAUTH_GOOGLE_FAILED', metadata: { reason: e?.message || 'unknown' } as any } });
      if (outMode === 'json') return res.status(500).json({ ok: false, error: 'OAuth login failed' });
      return res.redirect(`${frontendUrl}/auth/login?error=${encodeURIComponent('OAuth login failed')}`);
    }
  }
}

