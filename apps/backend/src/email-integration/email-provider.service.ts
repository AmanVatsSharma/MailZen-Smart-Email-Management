import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderInput } from './dto/email-provider.input';
import { SmtpSettingsInput } from './dto/smtp-settings.input';
import { createTransport, Transporter } from 'nodemailer';
import * as NodeCache from 'node-cache';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { BillingService } from '../billing/billing.service';
import { GmailSyncService } from '../gmail-sync/gmail-sync.service';
import { OutlookSyncService } from '../outlook-sync/outlook-sync.service';
import { WorkspaceService } from '../workspace/workspace.service';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  resolveProviderSecretsKeyring,
  ProviderSecretsKeyring,
} from '../common/provider-secrets.util';

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
    private readonly billingService: BillingService,
    private readonly workspaceService: WorkspaceService,
    private readonly gmailSyncService: GmailSyncService,
    private readonly outlookSyncService: OutlookSyncService,
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
        `Failed to connect Gmail: ${error.message}`,
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
        `Failed to connect Gmail from OAuth tokens: ${error.message}`,
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
        `Failed to connect Outlook: ${error.message}`,
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
        `Failed to connect SMTP: ${error.message}`,
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
        `Failed to update provider active state: ${error.message}`,
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
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Provider sync failed';
      this.logger.warn(
        `provider-sync: providerId=${providerId} type=${provider.type} failed error=${message}`,
      );
      await this.providerRepository.update(providerId, {
        status: 'error',
        syncLeaseExpiresAt: null,
        lastSyncError: message.slice(0, 500),
        lastSyncErrorAt: new Date(),
      });
    }

    return this.getProviderUi(providerId, userId);
  }

  async syncUserProviders(input: {
    userId: string;
    workspaceId?: string | null;
    providerId?: string | null;
  }) {
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
          `provider-sync-batch: providerId=${provider.id} userId=${input.userId} failed error=${message}`,
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

      switch (config.providerType) {
        case 'GMAIL':
          return this.configureGmail(config, userId);
        case 'OUTLOOK':
          return this.configureOutlook(config, userId);
        case 'CUSTOM_SMTP':
          return this.configureSmtp(config, userId);
        default:
          throw new BadRequestException(
            `Unsupported provider type: ${config.providerType}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to configure provider: ${error.message}`,
        error.stack,
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
      `email-provider-service: provider limit reached userId=${userId} current=${currentProviderCount} limit=${entitlements.providerLimit}`,
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
        `Failed to configure Gmail provider: ${error.message}`,
        error.stack,
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
        `Failed to configure Outlook provider: ${error.message}`,
        error.stack,
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
        `Failed to configure SMTP provider: ${error.message}`,
        error.stack,
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
        `Failed to get provider emails: ${error.message}`,
        error.stack,
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
        `Failed to get all providers: ${error.message}`,
        error.stack,
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
        `Failed to get provider: ${error.message}`,
        error.stack,
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

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete provider: ${error.message}`,
        error.stack,
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
        `Failed to update provider credentials: ${error.message}`,
        error.stack,
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
        `Provider validation failed: ${error.message}`,
        error.stack,
      );
      return {
        valid: false,
        message: error.message || 'Provider validation failed',
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
        `Failed to refresh OAuth token: ${error.message}`,
        error.stack,
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
          `Removed idle connection for provider ${id} from pool`,
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
        `Removed connection for provider ${providerId} from pool`,
      );
    }
  }
}
