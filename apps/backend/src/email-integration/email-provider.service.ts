import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderInput } from './dto/email-provider.input';
import { SmtpSettingsInput } from './dto/smtp-settings.input';
import { createTransport, Transporter } from 'nodemailer';
import * as NodeCache from 'node-cache';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { BillingService } from '../billing/billing.service';
import { GmailSyncService } from '../gmail-sync/gmail-sync.service';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { OutlookSyncService } from '../outlook-sync/outlook-sync.service';
import { WorkspaceService } from '../workspace/workspace.service';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  resolveProviderSecretsKeyring,
  ProviderSecretsKeyring,
} from '../common/provider-secrets.util';
import { UserNotification } from '../notification/entities/user-notification.entity';

interface SmtpConnectionPool {
  [key: string]: {
    transporter: Transporter;
    lastUsed: Date;
  };
}

/**
 * EmailProviderService - Manages external email provider integrations
 * Handles OAuth flows, SMTP connections, and provider lifecycle
 */
@Injectable()
export class EmailProviderService {
  private readonly logger = new Logger(EmailProviderService.name);
  private static readonly MIN_PROVIDER_SYNC_STATS_WINDOW_HOURS = 1;
  private static readonly MAX_PROVIDER_SYNC_STATS_WINDOW_HOURS = 24 * 30;
  private static readonly MIN_PROVIDER_SYNC_EXPORT_LIMIT = 1;
  private static readonly MAX_PROVIDER_SYNC_EXPORT_LIMIT = 500;
  private static readonly DEFAULT_PROVIDER_SYNC_ALERT_BUCKET_MINUTES = 60;
  private static readonly MIN_PROVIDER_SYNC_ALERT_BUCKET_MINUTES = 5;
  private static readonly MAX_PROVIDER_SYNC_ALERT_BUCKET_MINUTES = 24 * 60;
  private static readonly DEFAULT_PROVIDER_SYNC_ALERT_HISTORY_LIMIT = 100;
  private static readonly MIN_PROVIDER_SYNC_ALERT_HISTORY_LIMIT = 1;
  private static readonly MAX_PROVIDER_SYNC_ALERT_HISTORY_LIMIT = 500;
  private static readonly PROVIDER_SECRET_V2_PREFIX = 'enc:v2:';
  private static readonly PROVIDER_SECRET_V1_PREFIX = 'enc:v1:';
  private readonly googleOAuth2Client: OAuth2Client;
  private readonly providerSecretsKeyring: ProviderSecretsKeyring;
  private readonly smtpConnectionPool: SmtpConnectionPool = {};
  private readonly connectionCache = new NodeCache({
    stdTTL: 3600,
    checkperiod: 600,
  }); // 1 hour TTL, check every 10 minutes

  constructor(
    @InjectRepository(EmailProvider)
    private readonly providerRepository: Repository<EmailProvider>,
    @InjectRepository(UserNotification)
    private readonly notificationRepository: Repository<UserNotification>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly billingService: BillingService,
    private readonly workspaceService: WorkspaceService,
    private readonly gmailSyncService: GmailSyncService,
    private readonly outlookSyncService: OutlookSyncService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {
    this.providerSecretsKeyring = resolveProviderSecretsKeyring();

    // Setup Google OAuth client
    this.googleOAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    // Start connection pool cleanup interval
    setInterval(() => this.cleanupConnectionPool(), 15 * 60 * 1000); // Run every 15 minutes
  }

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId: input.userId,
          action: input.action,
          metadata: input.metadata || {},
        }),
      );
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private async resolveDefaultWorkspaceId(userId: string): Promise<string> {
    const workspaces = await this.workspaceService.listMyWorkspaces(userId);
    const preferredWorkspace =
      workspaces.find((workspace) => workspace.isPersonal) || workspaces[0];
    if (!preferredWorkspace) {
      throw new BadRequestException('No workspace available for this user');
    }
    return preferredWorkspace.id;
  }

  private encryptSecretIfPresent(secret?: string | null): string | undefined {
    if (!secret) return undefined;
    return encryptProviderSecret(secret, this.providerSecretsKeyring);
  }

  private decryptSecretIfPresent(secret?: string | null): string | undefined {
    if (!secret) return undefined;
    return decryptProviderSecret(secret, this.providerSecretsKeyring);
  }

  private resolveEncryptedSecretKeyId(secret: string): string | null {
    if (!secret.startsWith(EmailProviderService.PROVIDER_SECRET_V2_PREFIX)) {
      return null;
    }
    const payload = secret.slice(
      EmailProviderService.PROVIDER_SECRET_V2_PREFIX.length,
    );
    const [keyId] = payload.split(':');
    const normalizedKeyId = String(keyId || '').trim();
    return normalizedKeyId || null;
  }

  private resolveSecretFieldSource(secret: string): string {
    if (secret.startsWith(EmailProviderService.PROVIDER_SECRET_V1_PREFIX)) {
      return 'enc:v1';
    }
    if (secret.startsWith(EmailProviderService.PROVIDER_SECRET_V2_PREFIX)) {
      const keyId = this.resolveEncryptedSecretKeyId(secret);
      return keyId ? `enc:v2:${keyId}` : 'enc:v2:unknown';
    }
    return 'plaintext';
  }

  private async persistRotatedSecretField(
    providerId: string,
    field: 'accessToken' | 'refreshToken' | 'password',
    encryptedSecret: string,
  ): Promise<void> {
    if (field === 'accessToken') {
      await this.providerRepository.update(providerId, {
        accessToken: encryptedSecret,
      });
      return;
    }
    if (field === 'refreshToken') {
      await this.providerRepository.update(providerId, {
        refreshToken: encryptedSecret,
      });
      return;
    }
    await this.providerRepository.update(providerId, {
      password: encryptedSecret,
    });
  }

  private async rotateProviderSecretFieldIfNeeded(
    provider: EmailProvider,
    field: 'accessToken' | 'refreshToken' | 'password',
  ): Promise<void> {
    const secret = provider[field];
    if (!secret) return;

    const encryptedKeyId = this.resolveEncryptedSecretKeyId(secret);
    const alreadyEncryptedWithActiveKey =
      encryptedKeyId === this.providerSecretsKeyring.activeKeyId;
    if (alreadyEncryptedWithActiveKey) return;

    const sourceEncoding = this.resolveSecretFieldSource(secret);
    const decryptedSecret = this.decryptSecretIfPresent(secret);
    if (!decryptedSecret) return;

    const rotatedSecret = encryptProviderSecret(
      decryptedSecret,
      this.providerSecretsKeyring,
    );
    if (rotatedSecret === secret) return;

    await this.persistRotatedSecretField(provider.id, field, rotatedSecret);
    provider[field] = rotatedSecret;
    this.logger.log(
      serializeStructuredLog({
        event: 'provider_secret_rotated_to_active_key',
        providerId: provider.id,
        userId: provider.userId,
        field,
        sourceEncoding,
        activeKeyId: this.providerSecretsKeyring.activeKeyId,
      }),
    );
  }

  private async rotateProviderSecretsIfNeeded(
    provider: EmailProvider,
    fields: Array<'accessToken' | 'refreshToken' | 'password'>,
  ): Promise<void> {
    for (const field of fields) {
      await this.rotateProviderSecretFieldIfNeeded(provider, field);
    }
  }

  /**
   * Returns a valid access token for OAuth providers.
   * If token is near expiry, refreshes it.
   *
   * This is used by inbox sync modules (Gmail/Outlook) that need API access.
   */
  async getValidAccessToken(
    providerId: string,
    userId: string,
  ): Promise<string | null> {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (!['GMAIL', 'OUTLOOK'].includes(provider.type)) return null;
    await this.rotateProviderSecretsIfNeeded(provider, [
      'accessToken',
      'refreshToken',
    ]);

    // Refresh if expiring soon (within 5 minutes)
    if (provider.tokenExpiry) {
      const now = Date.now();
      const expiry = new Date(provider.tokenExpiry).getTime();
      if (expiry <= now + 5 * 60 * 1000) {
        await this.refreshOAuthToken(provider as any);
      }
    }

    const updated = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    return this.decryptSecretIfPresent(updated?.accessToken) || null;
  }

  /**
   * OAuth code exchange for Gmail connect flow.
   *
   * IMPORTANT: The redirect URI used to obtain the authorization `code` must match
   * the redirect URI configured on the OAuth client. If your frontend uses a Next.js
   * callback URL, set `GOOGLE_PROVIDER_REDIRECT_URI` to that value.
   */
  async connectGmail(code: string, userId: string) {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri =
        process.env.GOOGLE_PROVIDER_REDIRECT_URI ||
        process.env.GOOGLE_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) {
        throw new BadRequestException('Google OAuth not configured');
      }

      const oauth = new OAuth2Client(clientId, clientSecret, redirectUri);
      const { tokens } = await oauth.getToken(code);
      if (!tokens.access_token) {
        throw new BadRequestException(
          'Google OAuth did not return an access token',
        );
      }

      // Use UserInfo endpoint to derive the provider email (frontend includes userinfo.email scope).
      const me = await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        },
      );
      const email = (me.data?.email || '').toLowerCase();
      if (!email) {
        throw new BadRequestException(
          'Could not resolve Gmail account email from OAuth token',
        );
      }

      const input: EmailProviderInput = {
        providerType: 'GMAIL',
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiry: tokens.expiry_date
          ? Math.floor(tokens.expiry_date / 1000)
          : undefined,
      };

      const created = await this.configureProvider(input, userId);
      // Set UI fields for provider management
      const displayName = `Gmail - ${email}`;
      const createdId = created.id;
      await this.providerRepository.update(createdId, {
        displayName,
        status: 'connected',
      });
      return this.getProviderUi(createdId, userId);
    } catch (error: any) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_connect_gmail_failed',
          userId,
          error: error.message,
        }),
        error.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      throw new InternalServerErrorException('Failed to connect Gmail');
    }
  }

  async connectGmailFromOAuthTokens(
    input: {
      email: string;
      accessToken: string;
      refreshToken?: string;
      expiryDate?: number;
    },
    userId: string,
  ) {
    try {
      const normalizedEmail = (input.email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new BadRequestException('Google account email is required');
      }
      if (!input.accessToken) {
        throw new BadRequestException('Google access token is required');
      }

      const providerInput: EmailProviderInput = {
        providerType: 'GMAIL',
        email: normalizedEmail,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenExpiry: input.expiryDate
          ? Math.floor(input.expiryDate / 1000)
          : undefined,
      };

      const created = await this.configureProvider(providerInput, userId);
      const displayName = `Gmail - ${normalizedEmail}`;
      await this.providerRepository.update(created.id, {
        displayName,
        status: 'connected',
      });

      return this.getProviderUi(created.id, userId);
    } catch (error: any) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_connect_gmail_oauth_tokens_failed',
          userId,
          error: error.message,
        }),
        error.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to connect Gmail from OAuth tokens',
      );
    }
  }

  async connectOutlook(code: string, userId: string) {
    try {
      const clientId = process.env.OUTLOOK_CLIENT_ID;
      const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
      const redirectUri =
        process.env.OUTLOOK_PROVIDER_REDIRECT_URI ||
        process.env.OUTLOOK_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) {
        throw new BadRequestException('Outlook OAuth not configured');
      }

      const tokenUrl =
        'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('redirect_uri', redirectUri);
      params.append('grant_type', 'authorization_code');
      params.append('code', code);

      const response = await axios.post(tokenUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const accessToken = response.data?.access_token;
      const refreshToken = response.data?.refresh_token;
      const expiresIn = response.data?.expires_in;
      if (!accessToken)
        throw new BadRequestException(
          'Outlook OAuth did not return access token',
        );

      // Get email from Microsoft Graph
      const me = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const email = (
        me.data?.mail ||
        me.data?.userPrincipalName ||
        ''
      ).toLowerCase();
      if (!email)
        throw new BadRequestException(
          'Could not resolve Outlook account email from OAuth token',
        );

      const tokenExpiry = expiresIn
        ? Math.floor(Date.now() / 1000) + Number(expiresIn)
        : undefined;
      const input: EmailProviderInput = {
        providerType: 'OUTLOOK',
        email,
        accessToken,
        refreshToken,
        tokenExpiry,
      };

      const created = await this.configureProvider(input, userId);
      const displayName = `Outlook - ${email}`;
      const createdId = created.id;
      await this.providerRepository.update(createdId, {
        displayName,
        status: 'connected',
      });
      return this.getProviderUi(createdId, userId);
    } catch (error: any) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_connect_outlook_failed',
          userId,
          error: error.message,
        }),
        error.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      throw new InternalServerErrorException('Failed to connect Outlook');
    }
  }

  async connectSmtp(settings: SmtpSettingsInput, userId: string) {
    try {
      const input: EmailProviderInput = {
        providerType: 'CUSTOM_SMTP',
        email: settings.email,
        host: settings.host,
        port: settings.port,
        password: settings.password,
      };

      const created = await this.configureProvider(input, userId);
      const displayName = `SMTP - ${settings.email}`;
      const createdId = created.id;
      await this.providerRepository.update(createdId, {
        displayName,
        status: 'connected',
      });
      return this.getProviderUi(createdId, userId);
    } catch (error: any) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_connect_smtp_failed',
          userId,
          error: error.message,
        }),
        error.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      throw new InternalServerErrorException('Failed to connect SMTP');
    }
  }

  async setActiveProvider(
    providerId: string,
    userId: string,
    isActive?: boolean,
  ) {
    try {
      const provider = await this.providerRepository.findOne({
        where: { id: providerId, userId },
      });
      if (!provider) throw new NotFoundException('Provider not found');

      // If enabling, disable all other providers for this user.
      if (isActive) {
        await this.providerRepository.update({ userId }, { isActive: false });
        await this.providerRepository.update(providerId, { isActive: true });
      } else if (isActive === false) {
        await this.providerRepository.update(providerId, { isActive: false });
      }

      return this.getProviderUi(providerId, userId);
    } catch (error: any) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_active_state_update_failed',
          userId,
          providerId,
          error: error.message,
        }),
        error.stack,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update provider');
    }
  }

  async disconnectProvider(providerId: string, userId: string) {
    // MVP behavior: delete provider entry (keeps semantics aligned with existing deleteProvider).
    await this.deleteProvider(providerId, userId);
    return { success: true, message: 'Provider disconnected' };
  }

  async syncProvider(providerId: string, userId: string) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    const previousErrorSignature = this.normalizeSyncErrorSignature(
      provider.lastSyncError,
    );
    await this.providerRepository.update(providerId, {
      status: 'syncing',
      lastSyncError: null,
      lastSyncErrorAt: null,
    });

    try {
      if (provider.type === 'GMAIL') {
        await this.gmailSyncService.syncGmailProvider(providerId, userId, 25);
      } else if (provider.type === 'OUTLOOK') {
        await this.outlookSyncService.syncOutlookProvider(
          providerId,
          userId,
          25,
        );
      } else if (provider.type === 'CUSTOM_SMTP') {
        const validationResult = await this.validateProvider(
          providerId,
          userId,
        );
        if (!validationResult.valid) {
          throw new BadRequestException(
            validationResult.message || 'SMTP provider sync validation failed',
          );
        }
        await this.providerRepository.update(providerId, {
          status: 'connected',
          lastSyncedAt: new Date(),
          lastSyncError: null,
          lastSyncErrorAt: null,
        });
      } else {
        await this.providerRepository.update(providerId, {
          status: 'connected',
          lastSyncedAt: new Date(),
          lastSyncError: null,
          lastSyncErrorAt: null,
        });
      }
      if (previousErrorSignature) {
        await this.notificationEventBus.publishSafely({
          userId,
          type: 'SYNC_RECOVERED',
          title: `${provider.type} sync recovered`,
          message:
            'MailZen has recovered synchronization for your provider connection.',
          metadata: {
            providerId,
            providerType: provider.type,
            workspaceId: provider.workspaceId || null,
            triggerSource: 'MANUAL',
          },
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Provider sync failed';
      const normalizedErrorMessage = this.normalizeSyncErrorSignature(message);
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_sync_failed',
          providerId,
          providerType: provider.type,
          error: message,
        }),
      );
      await this.providerRepository.update(providerId, {
        status: 'error',
        syncLeaseExpiresAt: null,
        lastSyncError: normalizedErrorMessage,
        lastSyncErrorAt: new Date(),
      });
      if (normalizedErrorMessage !== previousErrorSignature) {
        await this.notificationEventBus.publishSafely({
          userId,
          type: 'SYNC_FAILED',
          title: `${provider.type} sync failed`,
          message:
            'MailZen failed to sync your provider connection. We will retry automatically.',
          metadata: {
            providerId,
            providerType: provider.type,
            workspaceId: provider.workspaceId || null,
            attempts: 1,
            error: normalizedErrorMessage.slice(0, 240),
            triggerSource: 'MANUAL',
          },
        });
      }
    }

    return this.getProviderUi(providerId, userId);
  }

  private normalizeSyncErrorSignature(value: unknown): string {
    const normalized =
      typeof value === 'string'
        ? value
        : value instanceof Error
          ? value.message
          : value === null || value === undefined
            ? ''
            : JSON.stringify(value);
    return String(normalized).trim().slice(0, 500);
  }

  async syncUserProviders(input: {
    userId: string;
    workspaceId?: string | null;
    providerId?: string | null;
  }) {
    const runCorrelationId = resolveCorrelationId(undefined);
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedProviderId = String(input.providerId || '').trim();

    let providers: EmailProvider[] = [];
    if (normalizedProviderId) {
      const provider = await this.providerRepository.findOne({
        where: normalizedWorkspaceId
          ? {
              id: normalizedProviderId,
              userId: input.userId,
              workspaceId: normalizedWorkspaceId,
            }
          : {
              id: normalizedProviderId,
              userId: input.userId,
            },
      });
      if (!provider) {
        throw new NotFoundException('Provider not found');
      }
      providers = [provider];
    } else {
      providers = await this.providerRepository.find({
        where: normalizedWorkspaceId
          ? { userId: input.userId, workspaceId: normalizedWorkspaceId }
          : { userId: input.userId },
        order: { createdAt: 'DESC' },
      });
    }

    const now = Date.now();
    const results: Array<{
      providerId: string;
      providerType: string;
      providerEmail: string;
      success: boolean;
      error?: string | null;
    }> = [];
    let syncedProviders = 0;
    let failedProviders = 0;
    let skippedProviders = 0;
    this.logger.log(
      serializeStructuredLog({
        event: 'provider_sync_batch_start',
        userId: input.userId,
        runCorrelationId,
        workspaceId: normalizedWorkspaceId || null,
        providerId: normalizedProviderId || null,
        candidateProviders: providers.length,
      }),
    );

    for (const provider of providers) {
      const leaseExpiresAtMs = provider.syncLeaseExpiresAt
        ? new Date(provider.syncLeaseExpiresAt).getTime()
        : 0;
      if (
        String(provider.status || '')
          .trim()
          .toLowerCase() === 'syncing' &&
        leaseExpiresAtMs > now
      ) {
        skippedProviders += 1;
        this.logger.log(
          serializeStructuredLog({
            event: 'provider_sync_batch_provider_skipped',
            userId: input.userId,
            providerId: provider.id,
            providerType: provider.type,
            workspaceId: provider.workspaceId || null,
            runCorrelationId,
            reason: 'active-lease',
          }),
        );
        results.push({
          providerId: provider.id,
          providerType: provider.type,
          providerEmail: provider.email,
          success: false,
          error: 'Provider sync is already running',
        });
        continue;
      }

      try {
        const syncedProvider = await this.syncProvider(
          provider.id,
          input.userId,
        );
        const failed =
          String(syncedProvider.status || '')
            .trim()
            .toLowerCase() === 'error';
        if (failed) {
          failedProviders += 1;
        } else {
          syncedProviders += 1;
        }
        this.logger.log(
          serializeStructuredLog({
            event: 'provider_sync_batch_provider_completed',
            userId: input.userId,
            providerId: provider.id,
            providerType: provider.type,
            workspaceId: provider.workspaceId || null,
            runCorrelationId,
            success: !failed,
            status: syncedProvider.status,
            error: failed ? syncedProvider.lastSyncError || null : null,
          }),
        );
        results.push({
          providerId: provider.id,
          providerType: provider.type,
          providerEmail: provider.email,
          success: !failed,
          error: failed
            ? syncedProvider.lastSyncError || 'Provider sync failed'
            : null,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Provider sync failed';
        this.logger.warn(
          serializeStructuredLog({
            event: 'provider_sync_batch_provider_failed',
            userId: input.userId,
            providerId: provider.id,
            providerType: provider.type,
            workspaceId: provider.workspaceId || null,
            runCorrelationId,
            error: message,
          }),
        );
        failedProviders += 1;
        results.push({
          providerId: provider.id,
          providerType: provider.type,
          providerEmail: provider.email,
          success: false,
          error: message.slice(0, 500),
        });
      }
    }

    this.logger.log(
      serializeStructuredLog({
        event: 'provider_sync_batch_completed',
        userId: input.userId,
        runCorrelationId,
        workspaceId: normalizedWorkspaceId || null,
        providerId: normalizedProviderId || null,
        requestedProviders: providers.length,
        syncedProviders,
        failedProviders,
        skippedProviders,
      }),
    );
    return {
      requestedProviders: providers.length,
      syncedProviders,
      failedProviders,
      skippedProviders,
      results,
      executedAtIso: new Date().toISOString(),
    };
  }

  private normalizeSyncStatsWindowHours(windowHours?: number | null): number {
    if (typeof windowHours !== 'number' || !Number.isFinite(windowHours)) {
      return 24;
    }
    const rounded = Math.trunc(windowHours);
    if (rounded < EmailProviderService.MIN_PROVIDER_SYNC_STATS_WINDOW_HOURS) {
      return EmailProviderService.MIN_PROVIDER_SYNC_STATS_WINDOW_HOURS;
    }
    if (rounded > EmailProviderService.MAX_PROVIDER_SYNC_STATS_WINDOW_HOURS) {
      return EmailProviderService.MAX_PROVIDER_SYNC_STATS_WINDOW_HOURS;
    }
    return rounded;
  }

  async getProviderSyncStatsForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
  }) {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const cutoff = new Date(
      Date.now() - normalizedWindowHours * 60 * 60 * 1000,
    );

    const providers = await this.providerRepository.find({
      where: normalizedWorkspaceId
        ? { userId: input.userId, workspaceId: normalizedWorkspaceId }
        : { userId: input.userId },
    });

    let connectedProviders = 0;
    let syncingProviders = 0;
    let errorProviders = 0;
    let recentlySyncedProviders = 0;
    let recentlyErroredProviders = 0;

    for (const provider of providers) {
      const normalizedStatus = String(provider.status || '')
        .trim()
        .toLowerCase();
      if (normalizedStatus === 'syncing') {
        syncingProviders += 1;
      } else if (normalizedStatus === 'error') {
        errorProviders += 1;
      } else {
        connectedProviders += 1;
      }

      if (provider.lastSyncedAt && provider.lastSyncedAt >= cutoff) {
        recentlySyncedProviders += 1;
      }
      if (provider.lastSyncErrorAt && provider.lastSyncErrorAt >= cutoff) {
        recentlyErroredProviders += 1;
      }
    }

    return {
      totalProviders: providers.length,
      connectedProviders,
      syncingProviders,
      errorProviders,
      recentlySyncedProviders,
      recentlyErroredProviders,
      windowHours: normalizedWindowHours,
      executedAtIso: new Date().toISOString(),
    };
  }

  private normalizeProviderSyncExportLimit(limit?: number | null): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      return 200;
    }
    const rounded = Math.trunc(limit);
    if (rounded < EmailProviderService.MIN_PROVIDER_SYNC_EXPORT_LIMIT) {
      return EmailProviderService.MIN_PROVIDER_SYNC_EXPORT_LIMIT;
    }
    if (rounded > EmailProviderService.MAX_PROVIDER_SYNC_EXPORT_LIMIT) {
      return EmailProviderService.MAX_PROVIDER_SYNC_EXPORT_LIMIT;
    }
    return rounded;
  }

  async exportProviderSyncDataForUser(input: {
    userId: string;
    workspaceId?: string | null;
    limit?: number | null;
  }): Promise<{ generatedAtIso: string; dataJson: string }> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedLimit = this.normalizeProviderSyncExportLimit(input.limit);

    const providers = await this.providerRepository.find({
      where: normalizedWorkspaceId
        ? { userId: input.userId, workspaceId: normalizedWorkspaceId }
        : { userId: input.userId },
      order: { createdAt: 'DESC' },
      take: normalizedLimit,
    });

    const statusCounts = providers.reduce<Record<string, number>>(
      (accumulator, provider) => {
        const key =
          String(provider.status || '')
            .trim()
            .toLowerCase() || 'unknown';
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      },
      {},
    );

    const generatedAtIso = new Date().toISOString();
    const dataJson = JSON.stringify({
      exportVersion: 'v1',
      generatedAtIso,
      scope: {
        userId: input.userId,
        workspaceId: normalizedWorkspaceId || null,
      },
      summary: {
        totalProviders: providers.length,
        statusCounts,
      },
      providers: providers.map((provider) => ({
        id: provider.id,
        type: provider.type,
        email: provider.email,
        displayName: provider.displayName || null,
        status: provider.status,
        isActive: provider.isActive,
        workspaceId: provider.workspaceId || null,
        createdAtIso: provider.createdAt.toISOString(),
        updatedAtIso: provider.updatedAt.toISOString(),
        lastSyncedAtIso: provider.lastSyncedAt?.toISOString() || null,
        lastSyncErrorAtIso: provider.lastSyncErrorAt?.toISOString() || null,
        lastSyncError: provider.lastSyncError || null,
        syncLeaseExpiresAtIso:
          provider.syncLeaseExpiresAt?.toISOString() || null,
        gmailWatchExpirationAtIso:
          provider.gmailWatchExpirationAt?.toISOString() || null,
        gmailWatchLastRenewedAtIso:
          provider.gmailWatchLastRenewedAt?.toISOString() || null,
        outlookSyncCursor: provider.outlookSyncCursor || null,
        outlookPushSubscriptionId: provider.outlookPushSubscriptionId || null,
        outlookPushSubscriptionExpiresAtIso:
          provider.outlookPushSubscriptionExpiresAt?.toISOString() || null,
        outlookPushSubscriptionLastRenewedAtIso:
          provider.outlookPushSubscriptionLastRenewedAt?.toISOString() || null,
      })),
    });

    return {
      generatedAtIso,
      dataJson,
    };
  }

  private normalizeProviderSyncAlertBucketMinutes(
    bucketMinutes?: number | null,
  ): number {
    if (typeof bucketMinutes !== 'number' || !Number.isFinite(bucketMinutes)) {
      return EmailProviderService.DEFAULT_PROVIDER_SYNC_ALERT_BUCKET_MINUTES;
    }
    const rounded = Math.trunc(bucketMinutes);
    if (rounded < EmailProviderService.MIN_PROVIDER_SYNC_ALERT_BUCKET_MINUTES) {
      return EmailProviderService.MIN_PROVIDER_SYNC_ALERT_BUCKET_MINUTES;
    }
    if (rounded > EmailProviderService.MAX_PROVIDER_SYNC_ALERT_BUCKET_MINUTES) {
      return EmailProviderService.MAX_PROVIDER_SYNC_ALERT_BUCKET_MINUTES;
    }
    return rounded;
  }

  private normalizeProviderSyncAlertHistoryLimit(
    limit?: number | null,
  ): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      return EmailProviderService.DEFAULT_PROVIDER_SYNC_ALERT_HISTORY_LIMIT;
    }
    const rounded = Math.trunc(limit);
    if (rounded < EmailProviderService.MIN_PROVIDER_SYNC_ALERT_HISTORY_LIMIT) {
      return EmailProviderService.MIN_PROVIDER_SYNC_ALERT_HISTORY_LIMIT;
    }
    if (rounded > EmailProviderService.MAX_PROVIDER_SYNC_ALERT_HISTORY_LIMIT) {
      return EmailProviderService.MAX_PROVIDER_SYNC_ALERT_HISTORY_LIMIT;
    }
    return rounded;
  }

  private resolveProviderSyncAlertStatus(
    notification: UserNotification,
  ): 'FAILED' | 'RECOVERED' | 'UNKNOWN' {
    const normalizedType = String(notification.type || '')
      .trim()
      .toUpperCase();
    if (normalizedType === 'SYNC_FAILED') return 'FAILED';
    if (normalizedType === 'SYNC_RECOVERED') return 'RECOVERED';
    return 'UNKNOWN';
  }

  private resolveProviderSyncAlertNumberMetadata(
    notification: UserNotification,
    key: string,
  ): number | null {
    const rawValue = notification.metadata?.[key];
    if (rawValue === null || rawValue === undefined) return null;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return null;
    return Math.trunc(numericValue);
  }

  private resolveProviderSyncAlertStringMetadata(
    notification: UserNotification,
    key: string,
  ): string | null {
    const rawValue = notification.metadata?.[key];
    if (typeof rawValue !== 'string') return null;
    const normalized = rawValue.trim();
    return normalized || null;
  }

  private async listProviderSyncAlertNotifications(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    order?: 'ASC' | 'DESC';
    limit?: number | null;
  }): Promise<UserNotification[]> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const windowStart = new Date(
      Date.now() - normalizedWindowHours * 60 * 60 * 1000,
    );
    const baseWhere = {
      userId: input.userId,
      type: In(['SYNC_FAILED', 'SYNC_RECOVERED']),
      createdAt: MoreThanOrEqual(windowStart),
    };
    const whereClause = normalizedWorkspaceId
      ? [
          { ...baseWhere, workspaceId: normalizedWorkspaceId },
          { ...baseWhere, workspaceId: IsNull() },
        ]
      : baseWhere;
    const normalizedOrder = input.order === 'ASC' ? 'ASC' : 'DESC';
    const normalizedLimit =
      typeof input.limit === 'number' && Number.isFinite(input.limit)
        ? this.normalizeProviderSyncAlertHistoryLimit(input.limit)
        : null;
    return this.notificationRepository.find({
      where: whereClause,
      order: { createdAt: normalizedOrder },
      take: normalizedLimit || undefined,
    });
  }

  async getProviderSyncAlertDeliveryStatsForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
  }): Promise<{
    workspaceId?: string | null;
    windowHours: number;
    totalAlerts: number;
    failedAlerts: number;
    recoveredAlerts: number;
    lastAlertAtIso?: string | null;
  }> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const notifications = await this.listProviderSyncAlertNotifications({
      userId: input.userId,
      workspaceId: normalizedWorkspaceId || null,
      windowHours: normalizedWindowHours,
      order: 'ASC',
    });
    let failedAlerts = 0;
    let recoveredAlerts = 0;
    for (const notification of notifications) {
      const status = this.resolveProviderSyncAlertStatus(notification);
      if (status === 'FAILED') failedAlerts += 1;
      if (status === 'RECOVERED') recoveredAlerts += 1;
    }
    const lastNotification = notifications[notifications.length - 1];
    return {
      workspaceId: normalizedWorkspaceId || null,
      windowHours: normalizedWindowHours,
      totalAlerts: notifications.length,
      failedAlerts,
      recoveredAlerts,
      lastAlertAtIso: lastNotification
        ? lastNotification.createdAt.toISOString()
        : null,
    };
  }

  async getProviderSyncAlertDeliverySeriesForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<
    Array<{
      bucketStart: Date;
      totalAlerts: number;
      failedAlerts: number;
      recoveredAlerts: number;
    }>
  > {
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const normalizedBucketMinutes =
      this.normalizeProviderSyncAlertBucketMinutes(input.bucketMinutes);
    const notifications = await this.listProviderSyncAlertNotifications({
      userId: input.userId,
      workspaceId: input.workspaceId,
      windowHours: normalizedWindowHours,
      order: 'ASC',
    });
    const bucketSizeMs = normalizedBucketMinutes * 60 * 1000;
    const nowMs = Date.now();
    const windowStartDate = new Date(
      nowMs - normalizedWindowHours * 60 * 60 * 1000,
    );
    const windowStartMs =
      Math.floor(windowStartDate.getTime() / bucketSizeMs) * bucketSizeMs;
    const accumulator = new Map<
      number,
      { totalAlerts: number; failedAlerts: number; recoveredAlerts: number }
    >();
    for (const notification of notifications) {
      const bucketStartMs =
        Math.floor(notification.createdAt.getTime() / bucketSizeMs) *
        bucketSizeMs;
      const bucket = accumulator.get(bucketStartMs) || {
        totalAlerts: 0,
        failedAlerts: 0,
        recoveredAlerts: 0,
      };
      bucket.totalAlerts += 1;
      const status = this.resolveProviderSyncAlertStatus(notification);
      if (status === 'FAILED') bucket.failedAlerts += 1;
      if (status === 'RECOVERED') bucket.recoveredAlerts += 1;
      accumulator.set(bucketStartMs, bucket);
    }

    const series: Array<{
      bucketStart: Date;
      totalAlerts: number;
      failedAlerts: number;
      recoveredAlerts: number;
    }> = [];
    for (let cursor = windowStartMs; cursor <= nowMs; cursor += bucketSizeMs) {
      const bucket = accumulator.get(cursor) || {
        totalAlerts: 0,
        failedAlerts: 0,
        recoveredAlerts: 0,
      };
      series.push({
        bucketStart: new Date(cursor),
        totalAlerts: bucket.totalAlerts,
        failedAlerts: bucket.failedAlerts,
        recoveredAlerts: bucket.recoveredAlerts,
      });
    }
    return series;
  }

  async getProviderSyncAlertsForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    limit?: number | null;
  }): Promise<
    Array<{
      notificationId: string;
      workspaceId?: string | null;
      status: string;
      title: string;
      message: string;
      providerId?: string | null;
      providerType?: string | null;
      attempts?: number | null;
      error?: string | null;
      createdAt: Date;
    }>
  > {
    const normalizedLimit = this.normalizeProviderSyncAlertHistoryLimit(
      input.limit,
    );
    const notifications = await this.listProviderSyncAlertNotifications({
      userId: input.userId,
      workspaceId: input.workspaceId,
      windowHours: input.windowHours,
      order: 'DESC',
      limit: normalizedLimit,
    });
    return notifications.map((notification) => ({
      notificationId: notification.id,
      workspaceId: notification.workspaceId || null,
      status: this.resolveProviderSyncAlertStatus(notification),
      title: notification.title,
      message: notification.message,
      providerId: this.resolveProviderSyncAlertStringMetadata(
        notification,
        'providerId',
      ),
      providerType: this.resolveProviderSyncAlertStringMetadata(
        notification,
        'providerType',
      ),
      attempts: this.resolveProviderSyncAlertNumberMetadata(
        notification,
        'attempts',
      ),
      error: this.resolveProviderSyncAlertStringMetadata(notification, 'error'),
      createdAt: notification.createdAt,
    }));
  }

  async exportProviderSyncAlertDeliveryDataForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
    limit?: number | null;
  }): Promise<{ generatedAtIso: string; dataJson: string }> {
    const normalizedWorkspaceId =
      String(input.workspaceId || '').trim() || null;
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const normalizedBucketMinutes =
      this.normalizeProviderSyncAlertBucketMinutes(input.bucketMinutes);
    const normalizedLimit = this.normalizeProviderSyncAlertHistoryLimit(
      input.limit,
    );
    const [stats, series, alerts] = await Promise.all([
      this.getProviderSyncAlertDeliveryStatsForUser({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
      }),
      this.getProviderSyncAlertDeliverySeriesForUser({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
        bucketMinutes: normalizedBucketMinutes,
      }),
      this.getProviderSyncAlertsForUser({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
        limit: normalizedLimit,
      }),
    ]);
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
        bucketMinutes: normalizedBucketMinutes,
        limit: normalizedLimit,
        stats,
        series: series.map((point) => ({
          bucketStartIso: point.bucketStart.toISOString(),
          totalAlerts: point.totalAlerts,
          failedAlerts: point.failedAlerts,
          recoveredAlerts: point.recoveredAlerts,
        })),
        alertCount: alerts.length,
        alerts: alerts.map((alert) => ({
          ...alert,
          createdAtIso: alert.createdAt.toISOString(),
        })),
      }),
    };
  }

  private resolveProviderSyncIncidentAlertStatus(
    notification: UserNotification,
  ): 'WARNING' | 'CRITICAL' | 'UNKNOWN' {
    const rawStatus = notification.metadata?.status;
    if (typeof rawStatus !== 'string') return 'UNKNOWN';
    const normalized = rawStatus.trim().toUpperCase();
    if (normalized === 'WARNING') return 'WARNING';
    if (normalized === 'CRITICAL') return 'CRITICAL';
    return 'UNKNOWN';
  }

  private resolveProviderSyncIncidentAlertFloatMetadata(
    notification: UserNotification,
    key: string,
  ): number {
    const rawValue = notification.metadata?.[key];
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.round(numericValue * 100) / 100;
  }

  private resolveProviderSyncIncidentAlertIntMetadata(
    notification: UserNotification,
    key: string,
  ): number {
    const rawValue = notification.metadata?.[key];
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.trunc(numericValue);
  }

  private async listProviderSyncIncidentAlertNotifications(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    order?: 'ASC' | 'DESC';
    limit?: number | null;
  }): Promise<UserNotification[]> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const windowStart = new Date(
      Date.now() - normalizedWindowHours * 60 * 60 * 1000,
    );
    const baseWhere = {
      userId: input.userId,
      type: 'PROVIDER_SYNC_INCIDENT_ALERT',
      createdAt: MoreThanOrEqual(windowStart),
    };
    const whereClause = normalizedWorkspaceId
      ? [
          { ...baseWhere, workspaceId: normalizedWorkspaceId },
          { ...baseWhere, workspaceId: IsNull() },
        ]
      : baseWhere;
    const normalizedOrder = input.order === 'ASC' ? 'ASC' : 'DESC';
    const normalizedLimit =
      typeof input.limit === 'number' && Number.isFinite(input.limit)
        ? this.normalizeProviderSyncAlertHistoryLimit(input.limit)
        : null;
    return this.notificationRepository.find({
      where: whereClause,
      order: { createdAt: normalizedOrder },
      take: normalizedLimit || undefined,
    });
  }

  async getProviderSyncIncidentAlertDeliveryStatsForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
  }): Promise<{
    workspaceId?: string | null;
    windowHours: number;
    totalAlerts: number;
    warningAlerts: number;
    criticalAlerts: number;
    lastAlertAtIso?: string | null;
  }> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const notifications = await this.listProviderSyncIncidentAlertNotifications(
      {
        userId: input.userId,
        workspaceId: normalizedWorkspaceId || null,
        windowHours: normalizedWindowHours,
        order: 'ASC',
      },
    );
    let warningAlerts = 0;
    let criticalAlerts = 0;
    for (const notification of notifications) {
      const status = this.resolveProviderSyncIncidentAlertStatus(notification);
      if (status === 'WARNING') warningAlerts += 1;
      if (status === 'CRITICAL') criticalAlerts += 1;
    }
    const lastNotification = notifications[notifications.length - 1];
    return {
      workspaceId: normalizedWorkspaceId || null,
      windowHours: normalizedWindowHours,
      totalAlerts: notifications.length,
      warningAlerts,
      criticalAlerts,
      lastAlertAtIso: lastNotification
        ? lastNotification.createdAt.toISOString()
        : null,
    };
  }

  async getProviderSyncIncidentAlertDeliverySeriesForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<
    Array<{
      bucketStart: Date;
      totalAlerts: number;
      warningAlerts: number;
      criticalAlerts: number;
    }>
  > {
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const normalizedBucketMinutes =
      this.normalizeProviderSyncAlertBucketMinutes(input.bucketMinutes);
    const notifications = await this.listProviderSyncIncidentAlertNotifications(
      {
        userId: input.userId,
        workspaceId: input.workspaceId,
        windowHours: normalizedWindowHours,
        order: 'ASC',
      },
    );
    const bucketSizeMs = normalizedBucketMinutes * 60 * 1000;
    const nowMs = Date.now();
    const windowStartDate = new Date(
      nowMs - normalizedWindowHours * 60 * 60 * 1000,
    );
    const windowStartMs =
      Math.floor(windowStartDate.getTime() / bucketSizeMs) * bucketSizeMs;
    const accumulator = new Map<
      number,
      { totalAlerts: number; warningAlerts: number; criticalAlerts: number }
    >();
    for (const notification of notifications) {
      const bucketStartMs =
        Math.floor(notification.createdAt.getTime() / bucketSizeMs) *
        bucketSizeMs;
      const bucket = accumulator.get(bucketStartMs) || {
        totalAlerts: 0,
        warningAlerts: 0,
        criticalAlerts: 0,
      };
      bucket.totalAlerts += 1;
      const status = this.resolveProviderSyncIncidentAlertStatus(notification);
      if (status === 'WARNING') bucket.warningAlerts += 1;
      if (status === 'CRITICAL') bucket.criticalAlerts += 1;
      accumulator.set(bucketStartMs, bucket);
    }

    const series: Array<{
      bucketStart: Date;
      totalAlerts: number;
      warningAlerts: number;
      criticalAlerts: number;
    }> = [];
    for (let cursor = windowStartMs; cursor <= nowMs; cursor += bucketSizeMs) {
      const bucket = accumulator.get(cursor) || {
        totalAlerts: 0,
        warningAlerts: 0,
        criticalAlerts: 0,
      };
      series.push({
        bucketStart: new Date(cursor),
        totalAlerts: bucket.totalAlerts,
        warningAlerts: bucket.warningAlerts,
        criticalAlerts: bucket.criticalAlerts,
      });
    }
    return series;
  }

  async getProviderSyncIncidentAlertsForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    limit?: number | null;
  }): Promise<
    Array<{
      notificationId: string;
      workspaceId?: string | null;
      status: string;
      title: string;
      message: string;
      errorProviderPercent: number;
      errorProviders: number;
      totalProviders: number;
      warningErrorProviderPercent: number;
      criticalErrorProviderPercent: number;
      minErrorProviders: number;
      createdAt: Date;
    }>
  > {
    const normalizedLimit = this.normalizeProviderSyncAlertHistoryLimit(
      input.limit,
    );
    const notifications = await this.listProviderSyncIncidentAlertNotifications(
      {
        userId: input.userId,
        workspaceId: input.workspaceId,
        windowHours: input.windowHours,
        order: 'DESC',
        limit: normalizedLimit,
      },
    );
    return notifications.map((notification) => ({
      notificationId: notification.id,
      workspaceId: notification.workspaceId || null,
      status: this.resolveProviderSyncIncidentAlertStatus(notification),
      title: notification.title,
      message: notification.message,
      errorProviderPercent: this.resolveProviderSyncIncidentAlertFloatMetadata(
        notification,
        'errorProviderPercent',
      ),
      errorProviders: this.resolveProviderSyncIncidentAlertIntMetadata(
        notification,
        'errorProviders',
      ),
      totalProviders: this.resolveProviderSyncIncidentAlertIntMetadata(
        notification,
        'totalProviders',
      ),
      warningErrorProviderPercent:
        this.resolveProviderSyncIncidentAlertFloatMetadata(
          notification,
          'warningErrorProviderPercent',
        ),
      criticalErrorProviderPercent:
        this.resolveProviderSyncIncidentAlertFloatMetadata(
          notification,
          'criticalErrorProviderPercent',
        ),
      minErrorProviders: this.resolveProviderSyncIncidentAlertIntMetadata(
        notification,
        'minErrorProviders',
      ),
      createdAt: notification.createdAt,
    }));
  }

  async exportProviderSyncIncidentAlertHistoryDataForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    limit?: number | null;
  }): Promise<{ generatedAtIso: string; dataJson: string }> {
    const normalizedWorkspaceId =
      String(input.workspaceId || '').trim() || null;
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const normalizedLimit = this.normalizeProviderSyncAlertHistoryLimit(
      input.limit,
    );
    const alerts = await this.getProviderSyncIncidentAlertsForUser({
      userId: input.userId,
      workspaceId: normalizedWorkspaceId,
      windowHours: normalizedWindowHours,
      limit: normalizedLimit,
    });
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
        limit: normalizedLimit,
        alertCount: alerts.length,
        alerts: alerts.map((alert) => ({
          ...alert,
          createdAtIso: alert.createdAt.toISOString(),
        })),
      }),
    };
  }

  async exportProviderSyncIncidentAlertDeliveryDataForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
    limit?: number | null;
  }): Promise<{ generatedAtIso: string; dataJson: string }> {
    const normalizedWorkspaceId =
      String(input.workspaceId || '').trim() || null;
    const normalizedWindowHours = this.normalizeSyncStatsWindowHours(
      input.windowHours,
    );
    const normalizedBucketMinutes =
      this.normalizeProviderSyncAlertBucketMinutes(input.bucketMinutes);
    const normalizedLimit = this.normalizeProviderSyncAlertHistoryLimit(
      input.limit,
    );
    const [stats, series, alerts] = await Promise.all([
      this.getProviderSyncIncidentAlertDeliveryStatsForUser({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
      }),
      this.getProviderSyncIncidentAlertDeliverySeriesForUser({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
        bucketMinutes: normalizedBucketMinutes,
      }),
      this.getProviderSyncIncidentAlertsForUser({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
        limit: normalizedLimit,
      }),
    ]);
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        workspaceId: normalizedWorkspaceId,
        windowHours: normalizedWindowHours,
        bucketMinutes: normalizedBucketMinutes,
        limit: normalizedLimit,
        stats,
        series: series.map((point) => ({
          bucketStartIso: point.bucketStart.toISOString(),
          totalAlerts: point.totalAlerts,
          warningAlerts: point.warningAlerts,
          criticalAlerts: point.criticalAlerts,
        })),
        alertCount: alerts.length,
        alerts: alerts.map((alert) => ({
          ...alert,
          createdAtIso: alert.createdAt.toISOString(),
        })),
      }),
    };
  }

  async listProvidersUi(userId: string, workspaceId?: string | null) {
    const normalizedWorkspaceId = String(workspaceId || '').trim();
    const providers = await this.providerRepository.find({
      where: normalizedWorkspaceId
        ? { userId, workspaceId: normalizedWorkspaceId }
        : { userId },
      order: { createdAt: 'DESC' },
    });
    return providers.map((p) => this.mapToProviderUi(p));
  }

  private async getProviderUi(providerId: string, userId: string) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return this.mapToProviderUi(provider);
  }

  private mapToProviderUi(provider: any) {
    const typeLower =
      provider.type === 'CUSTOM_SMTP'
        ? 'smtp'
        : provider.type === 'GMAIL'
          ? 'gmail'
          : provider.type === 'OUTLOOK'
            ? 'outlook'
            : (provider.type || '').toLowerCase();

    return {
      id: provider.id,
      type: typeLower,
      name:
        provider.displayName ||
        `${typeLower.toUpperCase()} - ${provider.email}`,
      email: provider.email,
      isActive: !!provider.isActive,
      lastSynced: provider.lastSyncedAt
        ? provider.lastSyncedAt.toISOString()
        : null,
      status: provider.status || 'connected',
      lastSyncErrorAt: provider.lastSyncErrorAt
        ? provider.lastSyncErrorAt.toISOString()
        : null,
      lastSyncError: provider.lastSyncError || null,
      workspaceId: provider.workspaceId || null,
    };
  }

  async configureProvider(config: EmailProviderInput, userId: string) {
    try {
      await this.enforceProviderLimit(userId);

      // Auto-detect provider type if requested
      if (config.autoDetect && config.email) {
        config.providerType = this.detectProviderType(config.email);
      }

      // Check if provider already exists
      const existingProvider = await this.providerRepository.findOne({
        where: {
          email: config.email,
          type: config.providerType,
          userId,
        },
      });

      if (existingProvider) {
        throw new ConflictException(
          `Provider ${config.providerType} with email ${config.email} already exists`,
        );
      }

      let configuredProvider: EmailProvider;
      switch (config.providerType) {
        case 'GMAIL':
          configuredProvider = await this.configureGmail(config, userId);
          break;
        case 'OUTLOOK':
          configuredProvider = await this.configureOutlook(config, userId);
          break;
        case 'CUSTOM_SMTP':
          configuredProvider = await this.configureSmtp(config, userId);
          break;
        default:
          throw new BadRequestException(
            `Unsupported provider type: ${config.providerType}`,
          );
      }

      await this.writeAuditLog({
        userId,
        action: 'provider_connected',
        metadata: {
          providerId: configuredProvider.id,
          providerType: configuredProvider.type,
          workspaceId: configuredProvider.workspaceId || null,
          accountFingerprint: fingerprintIdentifier(configuredProvider.email),
        },
      });

      return configuredProvider;
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_configure_failed',
          userId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to configure email provider',
      );
    }
  }

  private async enforceProviderLimit(userId: string): Promise<void> {
    const entitlements = await this.billingService.getEntitlements(userId);
    const currentProviderCount = await this.providerRepository.count({
      where: { userId },
    });
    if (currentProviderCount < entitlements.providerLimit) return;

    this.logger.warn(
      serializeStructuredLog({
        event: 'provider_limit_reached',
        userId,
        currentProviderCount,
        providerLimit: entitlements.providerLimit,
      }),
    );
    throw new BadRequestException(
      `Plan limit reached. Your ${entitlements.planCode} plan supports up to ${entitlements.providerLimit} connected providers.`,
    );
  }

  private detectProviderType(email: string): string {
    const domain = email.split('@')[1].toLowerCase();

    if (domain === 'gmail.com') {
      return 'GMAIL';
    } else if (
      domain === 'outlook.com' ||
      domain === 'hotmail.com' ||
      domain === 'live.com'
    ) {
      return 'OUTLOOK';
    } else {
      return 'CUSTOM_SMTP';
    }
  }

  private async configureGmail(config: EmailProviderInput, userId: string) {
    if (!config.accessToken) {
      throw new BadRequestException(
        'Access token is required for Gmail providers',
      );
    }

    try {
      const workspaceId = await this.resolveDefaultWorkspaceId(userId);
      const provider = this.providerRepository.create({
        type: 'GMAIL',
        email: config.email,
        accessToken: this.encryptSecretIfPresent(config.accessToken),
        refreshToken: this.encryptSecretIfPresent(config.refreshToken),
        tokenExpiry: config.tokenExpiry
          ? new Date(config.tokenExpiry * 1000)
          : undefined,
        userId,
        workspaceId,
      });
      return await this.providerRepository.save(provider);
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_configure_gmail_failed',
          userId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Failed to configure Gmail provider',
      );
    }
  }

  private async configureOutlook(config: EmailProviderInput, userId: string) {
    if (!config.accessToken) {
      throw new BadRequestException(
        'Access token is required for Outlook providers',
      );
    }

    try {
      const workspaceId = await this.resolveDefaultWorkspaceId(userId);
      const provider = this.providerRepository.create({
        type: 'OUTLOOK',
        email: config.email,
        accessToken: this.encryptSecretIfPresent(config.accessToken),
        refreshToken: this.encryptSecretIfPresent(config.refreshToken),
        tokenExpiry: config.tokenExpiry
          ? new Date(config.tokenExpiry * 1000)
          : undefined,
        userId,
        workspaceId,
      });
      return await this.providerRepository.save(provider);
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_configure_outlook_failed',
          userId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Failed to configure Outlook provider',
      );
    }
  }

  private async configureSmtp(config: EmailProviderInput, userId: string) {
    if (!config.host || !config.port || !config.password) {
      throw new BadRequestException(
        'Host, port, and password are required for SMTP providers',
      );
    }

    try {
      const workspaceId = await this.resolveDefaultWorkspaceId(userId);
      const provider = this.providerRepository.create({
        type: 'CUSTOM_SMTP',
        email: config.email,
        host: config.host,
        port: config.port,
        password: this.encryptSecretIfPresent(config.password),
        userId,
        workspaceId,
      });
      return await this.providerRepository.save(provider);
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_configure_smtp_failed',
          userId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Failed to configure SMTP provider',
      );
    }
  }

  async getProviderEmails(providerId: string, userId: string) {
    try {
      const provider = await this.providerRepository.findOne({
        where: {
          id: providerId,
          userId,
        },
        relations: ['emails'],
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${providerId} not found`);
      }

      return provider.emails;
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_emails_fetch_failed',
          userId,
          providerId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get provider emails');
    }
  }

  async getAllProviders(userId: string) {
    try {
      return await this.providerRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_list_failed',
          userId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to get email providers');
    }
  }

  async getProviderById(id: string, userId: string) {
    try {
      const provider = await this.providerRepository.findOne({
        where: {
          id,
          userId,
        },
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${id} not found`);
      }

      return provider;
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_get_failed',
          userId,
          providerId: id,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get email provider');
    }
  }

  async deleteProvider(id: string, userId: string) {
    try {
      // First verify that the provider exists and belongs to the user
      const provider = await this.providerRepository.findOne({
        where: {
          id,
          userId,
        },
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${id} not found`);
      }

      // Clean up from connection pool if it exists
      this.removeFromConnectionPool(id);

      // Delete the provider
      await this.providerRepository.delete(id);
      await this.writeAuditLog({
        userId,
        action: 'provider_disconnected',
        metadata: {
          providerId: provider.id,
          providerType: provider.type,
          workspaceId: provider.workspaceId || null,
          accountFingerprint: fingerprintIdentifier(provider.email),
        },
      });

      return true;
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_delete_failed',
          userId,
          providerId: id,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete email provider');
    }
  }

  async updateProviderCredentials(
    id: string,
    updatedData: Partial<EmailProviderInput>,
    userId: string,
  ) {
    try {
      // First verify that the provider exists and belongs to the user
      const provider = await this.providerRepository.findOne({
        where: {
          id,
          userId,
        },
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${id} not found`);
      }

      // Remove from connection pool to refresh with new credentials
      this.removeFromConnectionPool(id);

      // Prepare update data based on provider type
      const updateData: any = {};

      if (provider.type === 'CUSTOM_SMTP') {
        if (updatedData.host) updateData.host = updatedData.host;
        if (updatedData.port) updateData.port = updatedData.port;
        if (updatedData.password)
          updateData.password = this.encryptSecretIfPresent(
            updatedData.password,
          );
      } else if (['GMAIL', 'OUTLOOK'].includes(provider.type)) {
        if (updatedData.accessToken)
          updateData.accessToken = this.encryptSecretIfPresent(
            updatedData.accessToken,
          );
        if (updatedData.refreshToken)
          updateData.refreshToken = this.encryptSecretIfPresent(
            updatedData.refreshToken,
          );
        if (updatedData.tokenExpiry)
          updateData.tokenExpiry = new Date(updatedData.tokenExpiry * 1000);
      }

      // Update the provider
      await this.providerRepository.update(id, updateData);
      return await this.providerRepository.findOne({ where: { id } });
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_credentials_update_failed',
          userId,
          providerId: id,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update email provider credentials',
      );
    }
  }

  async validateProvider(id: string, userId: string) {
    try {
      const provider = await this.getProviderById(id, userId);

      // Try to get or create a transporter
      const transporter = await this.getTransporter(provider);

      // Verify connection
      const verifyResult = await transporter.verify();

      return {
        valid: !!verifyResult,
        message: 'Provider connection validated successfully',
      };
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_validation_failed',
          userId,
          providerId: id,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      return {
        valid: false,
        message:
          (error instanceof Error ? error.message : String(error)) ||
          'Provider validation failed',
      };
    }
  }

  async getTransporter(provider: any): Promise<Transporter> {
    const cacheKey = `transporter_${provider.id}`;

    // Check if we have a cached transporter
    if (this.connectionCache.has(cacheKey)) {
      return this.smtpConnectionPool[provider.id].transporter;
    }

    // If not in cache, check if we need to refresh OAuth token
    if (['GMAIL', 'OUTLOOK'].includes(provider.type)) {
      await this.rotateProviderSecretsIfNeeded(provider as EmailProvider, [
        'accessToken',
        'refreshToken',
      ]);
    }
    if (provider.type === 'CUSTOM_SMTP') {
      await this.rotateProviderSecretsIfNeeded(provider as EmailProvider, [
        'password',
      ]);
    }

    if (['GMAIL', 'OUTLOOK'].includes(provider.type) && provider.tokenExpiry) {
      const now = new Date();
      const expiry = new Date(provider.tokenExpiry);

      // If token is expired or about to expire (within 5 minutes), refresh it
      if (expiry <= new Date(now.getTime() + 5 * 60 * 1000)) {
        await this.refreshOAuthToken(provider);
      }
    }

    // Create a new transporter based on provider type
    let transporterConfig;
    let transporter;

    switch (provider.type) {
      case 'GMAIL':
        transporterConfig = {
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: provider.email,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            accessToken: this.decryptSecretIfPresent(provider.accessToken),
            refreshToken: this.decryptSecretIfPresent(provider.refreshToken),
            expires: provider.tokenExpiry
              ? new Date(provider.tokenExpiry).getTime()
              : undefined,
          },
        };
        break;
      case 'OUTLOOK':
        transporterConfig = {
          service: 'outlook',
          auth: {
            type: 'OAuth2',
            user: provider.email,
            clientId: process.env.OUTLOOK_CLIENT_ID,
            clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
            accessToken: this.decryptSecretIfPresent(provider.accessToken),
            refreshToken: this.decryptSecretIfPresent(provider.refreshToken),
            expires: provider.tokenExpiry
              ? new Date(provider.tokenExpiry).getTime()
              : undefined,
          },
        };
        break;
      case 'CUSTOM_SMTP':
        transporterConfig = {
          host: provider.host,
          port: provider.port,
          secure: provider.port === 465,
          auth: {
            user: provider.email,
            pass: this.decryptSecretIfPresent(provider.password),
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        };
        break;
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }

    transporter = createTransport(transporterConfig);

    // Add to connection pool
    this.smtpConnectionPool[provider.id] = {
      transporter,
      lastUsed: new Date(),
    };

    // Add to cache with TTL
    this.connectionCache.set(cacheKey, true);

    return transporter;
  }

  private async refreshOAuthToken(provider: any) {
    try {
      await this.rotateProviderSecretsIfNeeded(provider as EmailProvider, [
        'refreshToken',
      ]);
      const decryptedRefreshToken = this.decryptSecretIfPresent(
        provider.refreshToken,
      );
      if (provider.type === 'GMAIL' && decryptedRefreshToken) {
        // Refresh Google token
        this.googleOAuth2Client.setCredentials({
          refresh_token: decryptedRefreshToken,
        });

        const { credentials } =
          await this.googleOAuth2Client.refreshAccessToken();

        // Update provider with new token info
        await this.providerRepository.update(provider.id, {
          accessToken: this.encryptSecretIfPresent(
            credentials.access_token || undefined,
          ),
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : undefined,
        });

        // Update local reference
        provider.accessToken = credentials.access_token || undefined;
        provider.tokenExpiry = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : undefined;
      } else if (provider.type === 'OUTLOOK' && decryptedRefreshToken) {
        // Refresh Microsoft token
        const tokenUrl =
          'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        const params = new URLSearchParams();
        params.append('client_id', process.env.OUTLOOK_CLIENT_ID || '');
        params.append('client_secret', process.env.OUTLOOK_CLIENT_SECRET || '');
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', decryptedRefreshToken);

        const response = await axios.post(tokenUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        // Update provider with new token info
        const expiryDate = new Date();
        expiryDate.setSeconds(
          expiryDate.getSeconds() + response.data.expires_in,
        );

        await this.providerRepository.update(provider.id, {
          accessToken: this.encryptSecretIfPresent(response.data.access_token),
          refreshToken: this.encryptSecretIfPresent(
            response.data.refresh_token || decryptedRefreshToken,
          ), // Some providers don't return a new refresh token
          tokenExpiry: expiryDate,
        });

        // Update local reference
        provider.accessToken = response.data.access_token;
        provider.refreshToken =
          response.data.refresh_token || decryptedRefreshToken;
        provider.tokenExpiry = expiryDate;
      }
    } catch (error) {
      this.logger.error(
        serializeStructuredLog({
          event: 'provider_oauth_token_refresh_failed',
          providerId: provider.id,
          providerType: provider.type,
          userId: provider.userId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to refresh OAuth token');
    }
  }

  private cleanupConnectionPool() {
    const now = new Date();
    const idleTimeout = 30 * 60 * 1000; // 30 minutes

    for (const [id, connection] of Object.entries(this.smtpConnectionPool)) {
      const idleTime = now.getTime() - connection.lastUsed.getTime();

      if (idleTime > idleTimeout) {
        // Close the connection and remove from pool
        connection.transporter.close();
        delete this.smtpConnectionPool[id];
        this.connectionCache.del(`transporter_${id}`);
        this.logger.debug(
          serializeStructuredLog({
            event: 'provider_connection_pool_idle_connection_removed',
            providerId: id,
          }),
        );
      }
    }
  }

  private removeFromConnectionPool(providerId: string) {
    if (this.smtpConnectionPool[providerId]) {
      this.smtpConnectionPool[providerId].transporter.close();
      delete this.smtpConnectionPool[providerId];
      this.connectionCache.del(`transporter_${providerId}`);
      this.logger.debug(
        serializeStructuredLog({
          event: 'provider_connection_pool_connection_removed',
          providerId,
        }),
      );
    }
  }
}
