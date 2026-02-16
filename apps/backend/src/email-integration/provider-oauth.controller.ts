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
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

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

  private resolveRequestId(req: Request, res: Response): string {
    const requestId = resolveCorrelationId(
      (res.getHeader('x-request-id') as string | string[] | undefined) ||
        req.headers['x-request-id'],
    );
    res.setHeader('x-request-id', requestId);
    return requestId;
  }

  private resolveAuthenticatedUserId(req: Request): string | null {
    const maybeUser = (req as Request & { user?: { id?: string } }).user;
    const userId = String(maybeUser?.id || '').trim();
    return userId || null;
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
  }

  private resolveErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  private resolveDefaultProviderSettingsPath(): string {
    return '/email-providers';
  }

  private safeRedirectTarget(redirectOverride?: string): string {
    // Defensive default: never redirect to an empty value.
    // NOTE: We intentionally allow absolute URLs so local dev with different ports works.
    return redirectOverride && redirectOverride.trim().length > 0
      ? redirectOverride
      : `${this.getFrontendUrl()}/email-providers`;
  }

  private buildProviderRedirectUrl(input: {
    provider: 'google' | 'microsoft';
    requestId: string;
    redirectOverride?: string;
  }): URL {
    const frontendUrl = this.getFrontendUrl();
    const fallbackUrl = new URL(
      `${frontendUrl}${this.resolveDefaultProviderSettingsPath()}`,
    );
    const redirectTarget = this.safeRedirectTarget(input.redirectOverride);
    try {
      return new URL(redirectTarget, frontendUrl);
    } catch {
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_redirect_target_invalid',
          requestId: input.requestId,
          provider: input.provider,
          redirectTargetFingerprint: fingerprintIdentifier(redirectTarget),
          fallbackPath: this.resolveDefaultProviderSettingsPath(),
        }),
      );
      return fallbackUrl;
    }
  }

  @Get('google/start')
  googleStart(
    @Res() res: Response,
    @Req() req: Request,
    @Query('redirect') redirect?: string,
  ) {
    const requestId = this.resolveRequestId(req, res);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_PROVIDER_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_oauth_start_config_missing',
          requestId,
          provider: 'google',
          missingClientId: !clientId,
          missingRedirectUri: !redirectUri,
        }),
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

    this.logger.log(
      serializeStructuredLog({
        event: 'provider_oauth_start_redirect',
        requestId,
        provider: 'google',
        scopeCount: scope.split(' ').filter(Boolean).length,
        redirectTargetFingerprint: redirect
          ? fingerprintIdentifier(redirect)
          : null,
      }),
    );
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
    const requestId = this.resolveRequestId(req, res);
    const frontendUrl = this.getFrontendUrl();

    if (error) {
      const message = errorDescription || error;
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_callback_provider_error',
          requestId,
          provider: 'google',
          error: message,
        }),
      );
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', message);
      return res.redirect(url.toString());
    }

    if (!code || !state) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_callback_missing_code_or_state',
          requestId,
          provider: 'google',
          hasCode: Boolean(code),
          hasState: Boolean(state),
        }),
      );
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', 'Missing code/state');
      return res.redirect(url.toString());
    }

    let redirectOverride: string | undefined;
    try {
      const payload = verifyOAuthState(state, 10 * 60 * 1000);
      redirectOverride = payload.redirect;
    } catch (error: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_callback_invalid_state',
          requestId,
          provider: 'google',
          error: this.resolveErrorMessage(error),
        }),
      );
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', 'Invalid state');
      return res.redirect(url.toString());
    }

    const userId = this.resolveAuthenticatedUserId(req);
    if (!userId) {
      // If this happens, cookie auth is not being sent to backend domain.
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_callback_missing_user',
          requestId,
          provider: 'google',
          hasCookieHeader: Boolean(req.headers.cookie),
        }),
      );
      const url = new URL(`${frontendUrl}/auth/login`);
      url.searchParams.set(
        'redirect',
        this.resolveDefaultProviderSettingsPath(),
      );
      url.searchParams.set('error', 'Session expired. Please login again.');
      return res.redirect(url.toString());
    }

    try {
      await this.emailProviderService.connectGmail(code, userId);
      const target = this.buildProviderRedirectUrl({
        requestId,
        provider: 'google',
        redirectOverride,
      });
      target.searchParams.set('provider', 'gmail');
      target.searchParams.set('success', 'true');
      this.logger.log(
        serializeStructuredLog({
          event: 'provider_oauth_callback_connect_success',
          requestId,
          provider: 'google',
          userId,
        }),
      );
      return res.redirect(target.toString());
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_oauth_callback_connect_failed',
          requestId,
          provider: 'google',
          userId,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
      const target = this.buildProviderRedirectUrl({
        requestId,
        provider: 'google',
        redirectOverride,
      });
      target.searchParams.set('error', 'Failed to connect Gmail');
      return res.redirect(target.toString());
    }
  }

  @Get('microsoft/start')
  microsoftStart(
    @Res() res: Response,
    @Req() req: Request,
    @Query('redirect') redirect?: string,
  ) {
    const requestId = this.resolveRequestId(req, res);
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const redirectUri = process.env.OUTLOOK_PROVIDER_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_oauth_start_config_missing',
          requestId,
          provider: 'microsoft',
          missingClientId: !clientId,
          missingRedirectUri: !redirectUri,
        }),
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

    this.logger.log(
      serializeStructuredLog({
        event: 'provider_oauth_start_redirect',
        requestId,
        provider: 'microsoft',
        scopeCount: scope.split(' ').filter(Boolean).length,
        redirectTargetFingerprint: redirect
          ? fingerprintIdentifier(redirect)
          : null,
      }),
    );
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
    const requestId = this.resolveRequestId(req, res);
    const frontendUrl = this.getFrontendUrl();

    if (error) {
      const message = errorDescription || error;
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_callback_provider_error',
          requestId,
          provider: 'microsoft',
          error: message,
        }),
      );
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', message);
      return res.redirect(url.toString());
    }

    if (!code || !state) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_callback_missing_code_or_state',
          requestId,
          provider: 'microsoft',
          hasCode: Boolean(code),
          hasState: Boolean(state),
        }),
      );
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', 'Missing code/state');
      return res.redirect(url.toString());
    }

    let redirectOverride: string | undefined;
    try {
      const payload = verifyOAuthState(state, 10 * 60 * 1000);
      redirectOverride = payload.redirect;
    } catch (error: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_callback_invalid_state',
          requestId,
          provider: 'microsoft',
          error: this.resolveErrorMessage(error),
        }),
      );
      const url = new URL(`${frontendUrl}/email-providers`);
      url.searchParams.set('error', 'Invalid state');
      return res.redirect(url.toString());
    }

    const userId = this.resolveAuthenticatedUserId(req);
    if (!userId) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_oauth_callback_missing_user',
          requestId,
          provider: 'microsoft',
          hasCookieHeader: Boolean(req.headers.cookie),
        }),
      );
      const url = new URL(`${frontendUrl}/auth/login`);
      url.searchParams.set(
        'redirect',
        this.resolveDefaultProviderSettingsPath(),
      );
      url.searchParams.set('error', 'Session expired. Please login again.');
      return res.redirect(url.toString());
    }

    try {
      await this.emailProviderService.connectOutlook(code, userId);
      const target = this.buildProviderRedirectUrl({
        requestId,
        provider: 'microsoft',
        redirectOverride,
      });
      target.searchParams.set('provider', 'outlook');
      target.searchParams.set('success', 'true');
      this.logger.log(
        serializeStructuredLog({
          event: 'provider_oauth_callback_connect_success',
          requestId,
          provider: 'microsoft',
          userId,
        }),
      );
      return res.redirect(target.toString());
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_oauth_callback_connect_failed',
          requestId,
          provider: 'microsoft',
          userId,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
      const target = this.buildProviderRedirectUrl({
        requestId,
        provider: 'microsoft',
        redirectOverride,
      });
      target.searchParams.set('error', 'Failed to connect Outlook');
      return res.redirect(target.toString());
    }
  }
}
