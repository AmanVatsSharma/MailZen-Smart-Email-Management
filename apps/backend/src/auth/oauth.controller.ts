import {
  ConflictException,
  Controller,
  Get,
  Logger,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { buildOAuthState, verifyOAuthState } from './oauth-state.util';
import { User } from '../user/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { SessionCookieService } from './session-cookie.service';
import { EmailProviderService } from '../email-integration/email-provider.service';
import { MailboxService } from '../mailbox/mailbox.service';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly authService: AuthService,
    private readonly sessionCookie: SessionCookieService,
    private readonly emailProviderService: EmailProviderService,
    private readonly mailboxService: MailboxService,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      // Don't block boot: OAuth can be configured at deploy-time.
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_google_oauth_boot_config_missing',
          missingClientId: !clientId,
          missingClientSecret: !clientSecret,
          missingRedirectUri: !redirectUri,
        }),
      );
    }
    this.oauthClient = new OAuth2Client(
      clientId || '',
      clientSecret || '',
      redirectUri || '',
    );
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

  private async ensureGmailProviderConnected(input: {
    userId: string;
    email: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiryDate?: number | null;
  }): Promise<void> {
    const { userId, email, accessToken, refreshToken, expiryDate } = input;

    if (!accessToken) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_google_oauth_provider_autoconnect_skipped_missing_access_token',
          userId,
        }),
      );
      return;
    }

    let providerId: string | null = null;
    try {
      const provider =
        await this.emailProviderService.connectGmailFromOAuthTokens(
          {
            email,
            accessToken,
            refreshToken: refreshToken || undefined,
            expiryDate: expiryDate || undefined,
          },
          userId,
        );
      providerId = provider.id;
    } catch (error: any) {
      if (error instanceof ConflictException) {
        try {
          const providers = await this.emailProviderService.listProvidersUi(
            userId,
          );
          const existing = providers.find(
            (provider) =>
              provider.type === 'gmail' &&
              provider.email.toLowerCase() === email.toLowerCase(),
          );
          providerId = existing?.id || null;
        } catch (lookupError: any) {
          this.logger.warn(
            serializeStructuredLog({
              event: 'auth_google_oauth_provider_autoconnect_conflict_resolve_failed',
              userId,
              error: this.resolveErrorMessage(lookupError),
            }),
          );
        }
      } else {
        this.logger.warn(
          serializeStructuredLog({
            event: 'auth_google_oauth_provider_autoconnect_failed',
            userId,
            error: this.resolveErrorMessage(error),
          }),
        );
        return;
      }
    }

    if (!providerId) {
      return;
    }

    try {
      await this.emailProviderService.syncProvider(providerId, userId);
    } catch (error: any) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_google_oauth_provider_sync_trigger_failed',
          userId,
          providerId,
          error: this.resolveErrorMessage(error),
        }),
      );
    }
  }

  @Get('start')
  async start(
    @Res() res: Response,
    @Req() req: Request,
    @Query('redirect') redirect?: string,
  ) {
    const requestId = this.resolveRequestId(req, res);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return res.status(500).send('Google OAuth not configured');
    }

    // Default scopes support both identity login and immediate Gmail provider bootstrap.
    const scope =
      process.env.GOOGLE_OAUTH_SCOPES ||
      'openid email profile https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email';
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
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_google_oauth_start_redirect',
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
    @Query('mode') mode?: 'json' | 'redirect',
  ) {
    const requestId = this.resolveRequestId(req, res);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const outMode = mode || 'redirect';

    if (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_google_oauth_callback_provider_error',
          requestId,
          error,
        }),
      );
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          action: 'OAUTH_GOOGLE_FAILED',
          metadata: { error } as any,
        }),
      );
      if (outMode === 'json') return res.status(401).json({ ok: false, error });
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_google_oauth_callback_missing_code_or_state',
          requestId,
          hasCode: Boolean(code),
          hasState: Boolean(state),
        }),
      );
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          action: 'OAUTH_GOOGLE_FAILED',
          metadata: { reason: 'missing_code_or_state' } as any,
        }),
      );
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
    } catch (e: any) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_google_oauth_callback_invalid_state',
          requestId,
          error: this.resolveErrorMessage(e),
        }),
      );
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          action: 'OAUTH_GOOGLE_FAILED',
          metadata: { reason: 'invalid_state' } as any,
        }),
      );
      if (outMode === 'json')
        return res.status(401).json({ ok: false, error: 'Invalid state' });
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent('Invalid state')}`,
      );
    }

    try {
      // Exchange code for tokens.
      const { tokens } = await this.oauthClient.getToken(code);
      if (!tokens.id_token) {
        throw new Error(
          'Google did not return id_token (ensure openid scope is included)',
        );
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
      const emailFingerprint = fingerprintIdentifier(email);
      const googleSub = payload.sub;
      const name = payload.name || payload.given_name || null;
      const emailVerified = !!payload.email_verified;

      // Upsert user:
      // - Prefer matching by googleSub (stable)
      // - Fall back to email (common case for first-time linkage)
      const existingBySub = await this.userRepo.findOne({
        where: { googleSub } as any,
      });
      const existingByEmail = await this.userRepo.findOne({ where: { email } });
      const user = existingBySub || existingByEmail;

      let dbUser;
      if (!user) {
        dbUser = await this.userRepo.save(
          this.userRepo.create({
            email,
            password: undefined,
            name: name || undefined,
            isEmailVerified: emailVerified,
            googleSub,
          } as any),
        );
        this.logger.log(
          serializeStructuredLog({
            event: 'auth_google_oauth_user_created',
            requestId,
            userId: dbUser.id,
            emailFingerprint,
          }),
        );
      } else {
        // Guard against accidental account takeover: if email matches but googleSub differs, reject.
        if ((user as any).googleSub && (user as any).googleSub !== googleSub) {
          throw new Error(
            'This email is already linked to a different Google account',
          );
        }
        await this.userRepo.update({ id: user.id }, {
          name: user.name || name || undefined,
          googleSub,
          isEmailVerified: user.isEmailVerified || emailVerified,
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          lockoutUntil: null,
        } as any);
        dbUser = (await this.userRepo.findOne({
          where: { id: user.id },
        })) as any;
        this.logger.log(
          serializeStructuredLog({
            event: 'auth_google_oauth_user_updated',
            requestId,
            userId: dbUser.id,
            emailFingerprint,
          }),
        );
      }

      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          action: 'OAUTH_GOOGLE_SUCCESS',
          userId: dbUser.id,
          metadata: { email } as any,
        }),
      );

      const { accessToken } = this.authService.login(dbUser);
      const refreshToken = await this.authService.generateRefreshToken(
        dbUser.id,
        req.headers['user-agent'],
        req.ip,
      );

      this.sessionCookie.setTokenCookie(res, accessToken);

      await this.ensureGmailProviderConnected({
        userId: dbUser.id,
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      });

      const aliasState = await this.getAliasSetupState(dbUser.id);
      const aliasRedirectTarget = redirectOverride || '/';

      const finalRedirect = aliasState.requiresAliasSetup
        ? `${frontendUrl}/auth/alias-select?redirect=${encodeURIComponent(aliasRedirectTarget)}`
        : redirectOverride || `${frontendUrl}/auth/oauth-success`;

      if (outMode === 'json') {
        return res.json({
          ok: true,
          token: accessToken,
          refreshToken,
          user: { id: dbUser.id, email: dbUser.email, name: dbUser.name },
          ...aliasState,
        });
      }

      return res.redirect(finalRedirect);
    } catch (e: any) {
      this.logger.error(
        serializeStructuredLog({
          event: 'auth_google_oauth_callback_failed',
          requestId,
          error: this.resolveErrorMessage(e),
        }),
        e?.stack,
      );
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          action: 'OAUTH_GOOGLE_FAILED',
          metadata: { reason: e?.message || 'unknown' } as any,
        }),
      );
      if (outMode === 'json')
        return res.status(500).json({ ok: false, error: 'OAuth login failed' });
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent('OAuth login failed')}`,
      );
    }
  }
}
