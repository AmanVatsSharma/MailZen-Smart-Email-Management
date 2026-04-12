import {
  Controller,
  Get,
  Logger,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { buildOAuthState, verifyOAuthState } from './oauth-state.util';
import { User } from '../user/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { SessionCookieService } from './session-cookie.service';
import { MailboxService } from '../mailbox/mailbox.service';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

const MS_TOKEN_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_AUTHORIZE_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me';

/**
 * Microsoft OAuth login (code flow) — identity only.
 *
 * This controller handles Microsoft account sign-in/sign-up.
 * Mailbox provider linking (Outlook sync) is a separate flow handled by
 * ProviderOAuthController under /email-integration.
 *
 * Flow:
 *   1. Frontend links to GET /auth/microsoft/start
 *   2. User authenticates with Microsoft
 *   3. Microsoft redirects to GET /auth/microsoft/callback?code=...&state=...
 *   4. Backend exchanges code, upserts user by microsoftSub, issues JWT
 *   5. Redirect to frontend /auth/oauth-success (or alias setup)
 */
@Controller('auth/microsoft')
export class MicrosoftOAuthController {
  private readonly logger = new Logger(MicrosoftOAuthController.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly authService: AuthService,
    private readonly sessionCookie: SessionCookieService,
    private readonly mailboxService: MailboxService,
  ) {
    // Accept dedicated MICROSOFT_* vars or fall back to OUTLOOK_* for teams using
    // a single Azure app for both sign-in and mailbox provider linking.
    const clientId =
      process.env.MICROSOFT_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
    const clientSecret =
      process.env.MICROSOFT_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET;
    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI ||
      `${process.env.API_URL || 'http://localhost:4000'}/auth/microsoft/callback`;
    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_microsoft_oauth_boot_config_missing',
          missingClientId: !clientId,
          missingClientSecret: !clientSecret,
          missingRedirectUri: !redirectUri,
        }),
      );
    }
  }

  private resolveClientConfig(): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    const clientId =
      process.env.MICROSOFT_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID || '';
    const clientSecret =
      process.env.MICROSOFT_CLIENT_SECRET ||
      process.env.OUTLOOK_CLIENT_SECRET ||
      '';
    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI ||
      `${process.env.API_URL || 'http://localhost:4000'}/auth/microsoft/callback`;
    return { clientId, clientSecret, redirectUri };
  }

  private resolveRequestId(req: Request, res: Response): string {
    const requestId = resolveCorrelationId(
      (res.getHeader('x-request-id') as string | string[] | undefined) ||
        req.headers['x-request-id'],
    );
    res.setHeader('x-request-id', requestId);
    return requestId;
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
  }

  private resolveErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  private resolveSafeFrontendRedirect(input: {
    redirectOverride?: string;
    frontendUrl: string;
    fallbackPath: string;
    requestId: string;
  }): string {
    const fallbackUrl = new URL(
      input.fallbackPath,
      input.frontendUrl,
    ).toString();
    const override = String(input.redirectOverride || '').trim();
    if (!override) return fallbackUrl;

    try {
      const frontendOrigin = new URL(input.frontendUrl).origin;
      if (override.startsWith('/')) {
        return new URL(override, input.frontendUrl).toString();
      }
      const parsedOverride = new URL(override);
      if (parsedOverride.origin === frontendOrigin) {
        return parsedOverride.toString();
      }
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_microsoft_oauth_redirect_rejected_external',
          requestId: input.requestId,
          redirectOverrideFingerprint: fingerprintIdentifier(override),
        }),
      );
      return fallbackUrl;
    } catch {
      return fallbackUrl;
    }
  }

  private resolveUserAgent(req: Request): string | undefined {
    const ua: unknown = req.headers['user-agent'];
    if (typeof ua === 'string') return ua;
    if (Array.isArray(ua)) return ua.find((v): v is string => typeof v === 'string');
    return undefined;
  }

  private async writeAuditLog(input: {
    action: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    req: Request;
  }): Promise<void> {
    try {
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          action: input.action,
          userId: input.userId,
          metadata: input.metadata,
          ip: input.req.ip,
          userAgent: this.resolveUserAgent(input.req),
        }),
      );
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_microsoft_oauth_audit_log_write_failed',
          action: input.action,
          userId: input.userId || null,
          error: this.resolveErrorMessage(error),
        }),
      );
    }
  }

  private async getAliasSetupState(userId: string): Promise<{
    hasMailzenAlias: boolean;
    requiresAliasSetup: boolean;
    nextStep: string;
  }> {
    const mailboxes = await this.mailboxService.getUserMailboxes(userId);
    const hasMailzenAlias = mailboxes.length > 0;
    return {
      hasMailzenAlias,
      requiresAliasSetup: !hasMailzenAlias,
      nextStep: hasMailzenAlias ? '/' : '/auth/alias-select',
    };
  }

  @Get('start')
  start(
    @Res() res: Response,
    @Req() req: Request,
    @Query('redirect') redirect?: string,
  ) {
    const requestId = this.resolveRequestId(req, res);
    const { clientId, redirectUri } = this.resolveClientConfig();
    if (!clientId || !redirectUri) {
      this.logger.error(
        serializeStructuredLog({
          event: 'auth_microsoft_oauth_start_config_missing',
          requestId,
        }),
      );
      return res.status(500).send('Microsoft OAuth not configured');
    }

    const scope =
      process.env.MICROSOFT_OAUTH_SCOPES || 'openid email profile offline_access User.Read';
    const state = buildOAuthState(redirect);

    const url = new URL(MS_AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scope);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('state', state);

    this.logger.log(
      serializeStructuredLog({
        event: 'auth_microsoft_oauth_start_redirect',
        requestId,
        scopeCount: scope.split(' ').filter(Boolean).length,
        redirectOverrideFingerprint: redirect
          ? fingerprintIdentifier(redirect)
          : null,
      }),
    );

    return res.redirect(url.toString());
  }

  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Query('mode') mode?: 'json' | 'redirect',
  ) {
    const requestId = this.resolveRequestId(req, res);
    const frontendUrl = this.getFrontendUrl();
    const outMode = mode || 'redirect';

    if (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_microsoft_oauth_callback_provider_error',
          requestId,
          error,
          errorDescription,
        }),
      );
      await this.writeAuditLog({
        action: 'OAUTH_MICROSOFT_FAILED',
        metadata: { reason: 'provider_error', error, requestId },
        req,
      });
      if (outMode === 'json') return res.status(401).json({ ok: false, error });
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_microsoft_oauth_callback_missing_code_or_state',
          requestId,
          hasCode: Boolean(code),
          hasState: Boolean(state),
        }),
      );
      await this.writeAuditLog({
        action: 'OAUTH_MICROSOFT_FAILED',
        metadata: { reason: 'missing_code_or_state', requestId },
        req,
      });
      if (outMode === 'json')
        return res.status(400).json({ ok: false, error: 'Missing code/state' });
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent('Missing code/state')}`,
      );
    }

    let redirectOverride: string | undefined;
    try {
      const payload = verifyOAuthState(state, 10 * 60 * 1000);
      redirectOverride = payload.redirect;
    } catch (stateError: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_microsoft_oauth_callback_invalid_state',
          requestId,
          error: this.resolveErrorMessage(stateError),
        }),
      );
      await this.writeAuditLog({
        action: 'OAUTH_MICROSOFT_FAILED',
        metadata: { reason: 'invalid_state', requestId },
        req,
      });
      if (outMode === 'json')
        return res.status(401).json({ ok: false, error: 'Invalid state' });
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent('Invalid state')}`,
      );
    }

    try {
      const { clientId, clientSecret, redirectUri } = this.resolveClientConfig();
      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Microsoft OAuth not configured');
      }

      // Exchange authorization code for tokens.
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('redirect_uri', redirectUri);
      params.append('grant_type', 'authorization_code');
      params.append('code', code);

      const tokenResponse = await axios.post(MS_TOKEN_URL, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const accessToken: string = tokenResponse.data?.access_token;
      if (!accessToken) {
        throw new Error('Microsoft did not return an access token');
      }

      // Fetch user identity from Microsoft Graph.
      const meResponse = await axios.get(MS_GRAPH_ME_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const microsoftOid: string = meResponse.data?.id;
      const email: string = (
        meResponse.data?.mail ||
        meResponse.data?.userPrincipalName ||
        ''
      ).toLowerCase();
      const displayName: string =
        meResponse.data?.displayName || meResponse.data?.givenName || '';

      if (!microsoftOid) {
        throw new Error('Microsoft Graph did not return a user id (oid)');
      }
      if (!email) {
        throw new Error(
          'Could not resolve email from Microsoft Graph /me response',
        );
      }

      const accountFingerprint = fingerprintIdentifier(email);

      // Upsert user: prefer matching by microsoftSub (stable), fall back to email.
      const existingByOid = await this.userRepo.findOne({
        where: { microsoftSub: microsoftOid },
      });
      const existingByEmail = await this.userRepo.findOne({ where: { email } });
      const existingUser = existingByOid || existingByEmail;

      let dbUser: User | null = null;
      if (!existingUser) {
        dbUser = await this.userRepo.save(
          this.userRepo.create({
            email,
            name: displayName || undefined,
            isEmailVerified: true,
            microsoftSub: microsoftOid,
          }),
        );
        this.logger.log(
          serializeStructuredLog({
            event: 'auth_microsoft_oauth_user_created',
            requestId,
            userId: dbUser.id,
            accountFingerprint,
          }),
        );
      } else {
        // Guard against account takeover: if email matches but microsoftSub belongs to
        // a different account, reject the login attempt.
        if (
          existingUser.microsoftSub &&
          existingUser.microsoftSub !== microsoftOid
        ) {
          throw new Error(
            'This email is already linked to a different Microsoft account',
          );
        }
        await this.userRepo.update(
          { id: existingUser.id },
          {
            name: existingUser.name || displayName || undefined,
            microsoftSub: microsoftOid,
            isEmailVerified: true,
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockoutUntil: undefined,
          },
        );
        dbUser = await this.userRepo.findOne({
          where: { id: existingUser.id },
        });
        if (!dbUser) {
          throw new Error(
            'Microsoft OAuth user update completed but user reload failed',
          );
        }
        this.logger.log(
          serializeStructuredLog({
            event: 'auth_microsoft_oauth_user_updated',
            requestId,
            userId: dbUser.id,
            accountFingerprint,
          }),
        );
      }

      await this.writeAuditLog({
        action: 'OAUTH_MICROSOFT_SUCCESS',
        userId: dbUser.id,
        metadata: { accountFingerprint, requestId },
        req,
      });

      const { accessToken: jwtToken } = this.authService.login(dbUser);
      const refreshToken = await this.authService.generateRefreshToken(
        dbUser.id,
        this.resolveUserAgent(req),
        req.ip,
      );

      this.sessionCookie.setTokenCookie(res, jwtToken);

      const aliasState = await this.getAliasSetupState(dbUser.id);
      const successTarget = this.resolveSafeFrontendRedirect({
        redirectOverride,
        frontendUrl,
        fallbackPath: '/auth/oauth-success',
        requestId,
      });

      const finalRedirect = aliasState.requiresAliasSetup
        ? `${frontendUrl}/auth/alias-select?redirect=${encodeURIComponent(successTarget)}`
        : successTarget;

      if (outMode === 'json') {
        return res.json({
          ok: true,
          token: jwtToken,
          refreshToken,
          user: { id: dbUser.id, email: dbUser.email, name: dbUser.name },
          ...aliasState,
        });
      }

      return res.redirect(finalRedirect);
    } catch (callbackError: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'auth_microsoft_oauth_callback_failed',
          requestId,
          error: this.resolveErrorMessage(callbackError),
        }),
        this.resolveErrorStack(callbackError),
      );
      await this.writeAuditLog({
        action: 'OAUTH_MICROSOFT_FAILED',
        metadata: {
          reason: this.resolveErrorMessage(callbackError) || 'unknown',
          requestId,
        },
        req,
      });
      if (outMode === 'json')
        return res
          .status(500)
          .json({ ok: false, error: 'OAuth login failed' });
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent('OAuth login failed')}`,
      );
    }
  }
}
