import {
  Controller,
  Get,
  Logger,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { buildOAuthState, verifyOAuthState } from '../auth/oauth-state.util';
import { EmailProviderService } from './email-provider.service';

/**
 * Provider Linking OAuth (Backend-only).
 *
 * Why REST endpoints (instead of GraphQL):
 * - OAuth is redirect-based; REST endpoints map cleanly to redirects.
 * - Keeps sensitive client IDs / redirect URIs off the frontend.
 * - Lets the backend exchange the `code` and store tokens without exposing them.
 *
 * Flow (Google example):
 * 1) Frontend redirects user to: GET /email-integration/google/start?redirect=<frontend_return_url>
 * 2) Backend redirects to OAuth provider with signed `state`
 * 3) OAuth provider redirects to: GET /email-integration/google/callback?code=...&state=...
 * 4) Backend exchanges code, stores provider, then redirects back to frontend with success/error
 */
@Controller('email-integration')
@UseGuards(JwtAuthGuard)
export class ProviderOAuthController {
  private readonly logger = new Logger(ProviderOAuthController.name);

  constructor(private readonly emailProviderService: EmailProviderService) {}

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  private safeRedirectTarget(redirectOverride?: string): string {
    // Defensive default: never redirect to an empty value.
    // NOTE: We intentionally allow absolute URLs so local dev with different ports works.
    return redirectOverride && redirectOverride.trim().length > 0
      ? redirectOverride
      : `${this.getFrontendUrl()}/email-providers`;
  }

  @Get('google/start')
  async googleStart(
    @Res() res: Response,
    @Query('redirect') redirect?: string,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_PROVIDER_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      this.logger.error(
        'Google provider OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_PROVIDER_REDIRECT_URI)',
      );
      return res.status(500).send('Google provider OAuth not configured');
    }

    // Minimal required scopes:
    // - mail.google.com for full mail access (sync + send via API/SMTP OAuth)
    // - userinfo.email so backend can resolve provider mailbox email from access token
    const scope =
      process.env.GOOGLE_PROVIDER_OAUTH_SCOPES ||
      'https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email';
    const state = buildOAuthState(redirect);

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scope);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    this.logger.log(`Provider OAuth start -> Google (scopes=${scope})`);
    return res.redirect(url.toString());
  }

  @Get('google/callback')
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    const frontendUrl = this.getFrontendUrl();

    if (error) {
      const message = errorDescription || error;
      this.logger.warn(`Google provider OAuth callback error: ${message}`);
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', message);
      return res.redirect(url.toString());
    }

    if (!code || !state) {
      this.logger.warn('Google provider OAuth callback missing code/state');
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', 'Missing code/state');
      return res.redirect(url.toString());
    }

    let redirectOverride: string | undefined;
    try {
      const payload = verifyOAuthState(state, 10 * 60 * 1000);
      redirectOverride = payload.redirect;
    } catch (e: any) {
      this.logger.warn(
        `Google provider OAuth state validation failed: ${e?.message || e}`,
      );
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', 'Invalid state');
      return res.redirect(url.toString());
    }

    const userId = (req as any)?.user?.id;
    if (!userId) {
      // If this happens, cookie auth is not being sent to backend domain.
      this.logger.warn(
        'Google provider OAuth callback missing authenticated user (cookie not present?)',
      );
      const url = new URL(`${frontendUrl}/auth/login`);
      url.searchParams.set('redirect', encodeURIComponent('/email-providers'));
      url.searchParams.set('error', 'Session expired. Please login again.');
      return res.redirect(url.toString());
    }

    try {
      await this.emailProviderService.connectGmail(code, userId);
      const target = new URL(this.safeRedirectTarget(redirectOverride));
      target.searchParams.set('provider', 'gmail');
      target.searchParams.set('success', 'true');
      this.logger.log(`Google provider OAuth connected for user=${userId}`);
      return res.redirect(target.toString());
    } catch (e: any) {
      this.logger.error(
        `Google provider OAuth connect failed: ${e?.message || e}`,
        e?.stack,
      );
      const target = new URL(
        this.safeRedirectTarget(redirectOverride) ||
          `${frontendUrl}/email-providers`,
      );
      target.searchParams.set('error', 'Failed to connect Gmail');
      return res.redirect(target.toString());
    }
  }

  @Get('microsoft/start')
  async microsoftStart(
    @Res() res: Response,
    @Query('redirect') redirect?: string,
  ) {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const redirectUri = process.env.OUTLOOK_PROVIDER_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      this.logger.error(
        'Microsoft provider OAuth not configured (missing OUTLOOK_CLIENT_ID or OUTLOOK_PROVIDER_REDIRECT_URI)',
      );
      return res.status(500).send('Microsoft provider OAuth not configured');
    }

    const scope =
      process.env.OUTLOOK_PROVIDER_OAUTH_SCOPES ||
      'offline_access Mail.Read Mail.Send User.Read';
    const state = buildOAuthState(redirect);

    const url = new URL(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    );
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', scope);
    url.searchParams.set('state', state);

    this.logger.log(`Provider OAuth start -> Microsoft (scopes=${scope})`);
    return res.redirect(url.toString());
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    const frontendUrl = this.getFrontendUrl();

    if (error) {
      const message = errorDescription || error;
      this.logger.warn(`Microsoft provider OAuth callback error: ${message}`);
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', message);
      return res.redirect(url.toString());
    }

    if (!code || !state) {
      this.logger.warn('Microsoft provider OAuth callback missing code/state');
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', 'Missing code/state');
      return res.redirect(url.toString());
    }

    let redirectOverride: string | undefined;
    try {
      const payload = verifyOAuthState(state, 10 * 60 * 1000);
      redirectOverride = payload.redirect;
    } catch (e: any) {
      this.logger.warn(
        `Microsoft provider OAuth state validation failed: ${e?.message || e}`,
      );
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', 'Invalid state');
      return res.redirect(url.toString());
    }

    const userId = (req as any)?.user?.id;
    if (!userId) {
      this.logger.warn(
        'Microsoft provider OAuth callback missing authenticated user (cookie not present?)',
      );
      const url = new URL(`${frontendUrl}/auth/login`);
      url.searchParams.set('redirect', encodeURIComponent('/email-providers'));
      url.searchParams.set('error', 'Session expired. Please login again.');
      return res.redirect(url.toString());
    }

    try {
      await this.emailProviderService.connectOutlook(code, userId);
      const target = new URL(this.safeRedirectTarget(redirectOverride));
      target.searchParams.set('provider', 'outlook');
      target.searchParams.set('success', 'true');
      this.logger.log(`Microsoft provider OAuth connected for user=${userId}`);
      return res.redirect(target.toString());
    } catch (e: any) {
      this.logger.error(
        `Microsoft provider OAuth connect failed: ${e?.message || e}`,
        e?.stack,
      );
      const target = new URL(
        this.safeRedirectTarget(redirectOverride) ||
          `${frontendUrl}/email-providers`,
      );
      target.searchParams.set('error', 'Failed to connect Outlook');
      return res.redirect(target.toString());
    }
  }
}
