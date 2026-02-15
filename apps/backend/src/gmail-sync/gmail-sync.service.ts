/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  resolveProviderSecretsKeyring,
  ProviderSecretsKeyring,
} from '../common/provider-secrets.util';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';

type GmailListResponse = {
  messages?: { id: string; threadId?: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailMessageResponse = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
};

type GmailLabelsResponse = {
  labels?: {
    id: string;
    name: string;
    type?: string;
    color?: {
      backgroundColor?: string;
      textColor?: string;
    };
  }[];
};

type GmailHistoryResponse = {
  historyId?: string;
  history?: Array<{
    id?: string;
    messages?: Array<{ id: string; threadId?: string }>;
    messagesAdded?: Array<{
      message?: { id: string; threadId?: string };
    }>;
  }>;
};

type GmailWatchResponse = {
  historyId?: string;
  expiration?: string;
};

@Injectable()
export class GmailSyncService {
  private readonly logger = new Logger(GmailSyncService.name);
  private readonly googleOAuth2Client: OAuth2Client;
  private readonly providerSecretsKeyring: ProviderSecretsKeyring;

  constructor(
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepo: Repository<EmailProvider>,
    @InjectRepository(ExternalEmailLabel)
    private readonly externalEmailLabelRepo: Repository<ExternalEmailLabel>,
    @InjectRepository(ExternalEmailMessage)
    private readonly externalEmailMessageRepo: Repository<ExternalEmailMessage>,
    private readonly providerSyncLease: ProviderSyncLeaseService,
  ) {
    this.providerSecretsKeyring = resolveProviderSecretsKeyring();
    // Dedicated client for Gmail API access token refresh.
    this.googleOAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_PROVIDER_REDIRECT_URI ||
        process.env.GOOGLE_REDIRECT_URI,
    );
  }

  private async ensureFreshGmailAccessToken(provider: any): Promise<string> {
    const decryptedAccessToken = provider.accessToken
      ? decryptProviderSecret(provider.accessToken, this.providerSecretsKeyring)
      : '';
    const decryptedRefreshToken = provider.refreshToken
      ? decryptProviderSecret(
          provider.refreshToken,
          this.providerSecretsKeyring,
        )
      : '';

    if (!decryptedRefreshToken && !decryptedAccessToken) {
      throw new BadRequestException(
        'Missing OAuth credentials for Gmail provider',
      );
    }
    if (!provider.tokenExpiry || !decryptedRefreshToken) {
      return decryptedAccessToken;
    }

    const now = Date.now();
    const expiry = new Date(provider.tokenExpiry).getTime();
    if (expiry > now + 5 * 60 * 1000) {
      return decryptedAccessToken;
    }

    try {
      this.googleOAuth2Client.setCredentials({
        refresh_token: decryptedRefreshToken,
      });
      // google-auth-library v9 still supports refreshAccessToken (used elsewhere in repo)
      const { credentials } =
        await this.googleOAuth2Client.refreshAccessToken();
      if (!credentials.access_token)
        throw new Error('Google refresh did not return access_token');

      await this.emailProviderRepo.update(
        { id: provider.id },
        {
          accessToken: encryptProviderSecret(
            credentials.access_token,
            this.providerSecretsKeyring,
          ),
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : undefined,
        },
      );
      return credentials.access_token;
    } catch (e: any) {
      this.logger.error(
        `Failed to refresh Gmail access token: ${e?.message || e}`,
        e?.stack,
      );
      throw new InternalServerErrorException(
        'Failed to refresh Gmail access token',
      );
    }
  }

  private async syncGmailLabels(
    providerId: string,
    userId: string,
    accessToken: string,
  ) {
    try {
      const url = 'https://gmail.googleapis.com/gmail/v1/users/me/labels';
      const res = await axios.get<GmailLabelsResponse>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const labels = res.data.labels || [];
      const rows: Partial<ExternalEmailLabel>[] = labels.map((l) => {
        const isSystem = String(l.type || '').toLowerCase() === 'system';
        // Gmail label colors are optional and may require a separate API; use backgroundColor if present.
        const color = l.color?.backgroundColor || undefined;
        return {
          userId,
          providerId,
          externalLabelId: l.id,
          name: l.name,
          type: l.type || (isSystem ? 'system' : 'user'),
          color,
          isSystem,
        };
      });

      if (rows.length) {
        await this.externalEmailLabelRepo.upsert(rows, [
          'providerId',
          'externalLabelId',
        ]);
      }

      this.logger.log(
        `Synced Gmail labels provider=${providerId} user=${userId} count=${labels.length}`,
      );
    } catch (e: any) {
      // Label sync failure should not block message sync.
      this.logger.warn(
        `Failed to sync Gmail labels provider=${providerId} user=${userId}: ${e?.message || e}`,
      );
    }
  }

  private async getLatestGmailHistoryId(
    accessToken: string,
  ): Promise<string | null> {
    try {
      const profile = await axios.get<{ historyId?: string }>(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      return profile.data.historyId || null;
    } catch (e: any) {
      this.logger.warn(
        `Failed to read Gmail profile historyId: ${e?.message || e}`,
      );
      return null;
    }
  }

  private async listMessageIdsForSync(input: {
    accessToken: string;
    maxMessages: number;
    startHistoryId?: string | null;
  }): Promise<{
    ids: Array<{ id: string; threadId?: string }>;
    mode: 'history' | 'full';
    historyId: string | null;
  }> {
    const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
    const historyUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/history';
    const seen = new Set<string>();
    const ids: Array<{ id: string; threadId?: string }> = [];

    if (input.startHistoryId) {
      try {
        const history = await axios.get<GmailHistoryResponse>(historyUrl, {
          headers: { Authorization: `Bearer ${input.accessToken}` },
          params: {
            startHistoryId: input.startHistoryId,
            maxResults: input.maxMessages,
            historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved'],
          },
        });

        for (const entry of history.data.history || []) {
          for (const message of entry.messages || []) {
            if (!message.id || seen.has(message.id)) continue;
            seen.add(message.id);
            ids.push({ id: message.id, threadId: message.threadId });
          }
          for (const added of entry.messagesAdded || []) {
            const message = added.message;
            if (!message?.id || seen.has(message.id)) continue;
            seen.add(message.id);
            ids.push({ id: message.id, threadId: message.threadId });
          }
        }

        return {
          ids,
          mode: 'history',
          historyId: history.data.historyId || null,
        };
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404) {
          this.logger.warn(
            `Gmail history cursor expired provider startHistoryId=${input.startHistoryId}; falling back to full sync`,
          );
        } else {
          this.logger.warn(
            `Gmail history lookup failed (${status ?? 'n/a'}): ${e?.message || e}. Falling back to full sync`,
          );
        }
      }
    }

    const list = await axios.get<GmailListResponse>(listUrl, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
      params: { maxResults: input.maxMessages },
    });
    for (const message of list.data.messages || []) {
      if (!message.id || seen.has(message.id)) continue;
      seen.add(message.id);
      ids.push({ id: message.id, threadId: message.threadId });
    }
    return { ids, mode: 'full', historyId: null };
  }

  private resolvePushSyncMaxMessages(): number {
    const parsedValue = Number(process.env.GMAIL_PUSH_SYNC_MAX_MESSAGES || 25);
    const candidate = Number.isFinite(parsedValue)
      ? Math.floor(parsedValue)
      : 25;
    if (candidate < 1) return 1;
    if (candidate > 200) return 200;
    return candidate;
  }

  private resolveGmailPushWatchThresholdMinutes(): number {
    const parsedValue = Number(
      process.env.GMAIL_PUSH_WATCH_RENEW_THRESHOLD_MINUTES || 60,
    );
    const candidate = Number.isFinite(parsedValue)
      ? Math.floor(parsedValue)
      : 60;
    if (candidate < 1) return 1;
    if (candidate > 24 * 60) return 24 * 60;
    return candidate;
  }

  private resolveGmailPushWatchLabelIds(): string[] {
    const rawValue = String(process.env.GMAIL_PUSH_WATCH_LABEL_IDS || 'INBOX');
    const normalized = rawValue
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label.length > 0);
    if (!normalized.length) return ['INBOX'];
    return Array.from(new Set(normalized));
  }

  private normalizeHistoryId(rawValue?: string | null): string | null {
    const normalized = String(rawValue || '').trim();
    return normalized || null;
  }

  private shouldAdvanceHistoryCursor(input: {
    currentHistoryId?: string | null;
    incomingHistoryId?: string | null;
  }): boolean {
    const current = this.normalizeHistoryId(input.currentHistoryId);
    const incoming = this.normalizeHistoryId(input.incomingHistoryId);
    if (!incoming) return false;
    if (!current) return true;

    try {
      return BigInt(incoming) > BigInt(current);
    } catch {
      return incoming !== current;
    }
  }

  private async ensureGmailPushWatch(input: {
    provider: EmailProvider;
    accessToken: string;
  }): Promise<void> {
    const topicName = String(process.env.GMAIL_PUSH_TOPIC_NAME || '').trim();
    if (!topicName) return;

    const thresholdMinutes = this.resolveGmailPushWatchThresholdMinutes();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const expirationMs = input.provider.gmailWatchExpirationAt
      ? new Date(input.provider.gmailWatchExpirationAt).getTime()
      : 0;
    if (expirationMs > Date.now() + thresholdMs) {
      return;
    }

    try {
      const watchResponse = await axios.post<GmailWatchResponse>(
        'https://gmail.googleapis.com/gmail/v1/users/me/watch',
        {
          topicName,
          labelIds: this.resolveGmailPushWatchLabelIds(),
          labelFilterAction: 'include',
        },
        {
          headers: { Authorization: `Bearer ${input.accessToken}` },
        },
      );

      const incomingHistoryId = this.normalizeHistoryId(
        watchResponse.data.historyId,
      );
      const watchExpirationMs = Number(watchResponse.data.expiration || 0);
      const watchExpirationAt =
        Number.isFinite(watchExpirationMs) && watchExpirationMs > 0
          ? new Date(watchExpirationMs)
          : null;
      const shouldAdvanceHistory = this.shouldAdvanceHistoryCursor({
        currentHistoryId: input.provider.gmailHistoryId || null,
        incomingHistoryId,
      });
      await this.emailProviderRepo.update(
        { id: input.provider.id },
        {
          gmailHistoryId: shouldAdvanceHistory
            ? incomingHistoryId || input.provider.gmailHistoryId
            : input.provider.gmailHistoryId,
          gmailWatchLastRenewedAt: new Date(),
          gmailWatchExpirationAt: watchExpirationAt || undefined,
        },
      );
      this.logger.log(
        `Gmail push watch renewed provider=${input.provider.id} expiration=${watchExpirationAt ? watchExpirationAt.toISOString() : 'n/a'}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to renew Gmail push watch provider=${input.provider.id}: ${errorMessage}`,
      );
    }
  }

  async ensurePushWatchForProvider(
    providerId: string,
    userId: string,
  ): Promise<boolean> {
    const provider = await this.emailProviderRepo.findOne({
      where: { id: providerId, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.type !== 'GMAIL')
      throw new BadRequestException('Provider is not Gmail');
    const accessToken = await this.ensureFreshGmailAccessToken(provider);
    await this.ensureGmailPushWatch({ provider, accessToken });
    return true;
  }

  async processPushNotification(input: {
    emailAddress: string;
    historyId?: string | null;
  }): Promise<{ processedProviders: number; skippedProviders: number }> {
    const normalizedEmail = String(input.emailAddress || '')
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Gmail push notification email missing');
    }
    const providers = await this.emailProviderRepo.find({
      where: {
        type: 'GMAIL',
        isActive: true,
        email: normalizedEmail,
      },
    });
    if (!providers.length) {
      this.logger.warn(
        `Gmail push notification ignored: no active provider for email=${normalizedEmail}`,
      );
      return { processedProviders: 0, skippedProviders: 0 };
    }

    let processedProviders = 0;
    let skippedProviders = 0;
    const webhookHistoryId = this.normalizeHistoryId(input.historyId);
    const maxMessages = this.resolvePushSyncMaxMessages();

    for (const provider of providers) {
      const leaseAcquired =
        await this.providerSyncLease.acquireProviderSyncLease({
          providerId: provider.id,
          providerType: 'GMAIL',
        });
      if (!leaseAcquired) {
        skippedProviders += 1;
        continue;
      }

      if (
        this.shouldAdvanceHistoryCursor({
          currentHistoryId: provider.gmailHistoryId,
          incomingHistoryId: webhookHistoryId,
        })
      ) {
        await this.emailProviderRepo.update(
          { id: provider.id },
          { gmailHistoryId: webhookHistoryId || undefined },
        );
      }

      try {
        await this.syncGmailProvider(provider.id, provider.userId, maxMessages);
        processedProviders += 1;
      } catch (error: unknown) {
        skippedProviders += 1;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Gmail push processing failed provider=${provider.id}: ${errorMessage}`,
        );
      }
    }

    return { processedProviders, skippedProviders };
  }

  /**
   * Sync Gmail messages into `ExternalEmailMessage`.
   *
   * Strategy:
   * - Prefer incremental sync using stored `gmailHistoryId`.
   * - Fall back to full list sync when no cursor exists (or cursor expired).
   * - Upsert is idempotent via unique (providerId, externalMessageId).
   */
  async syncGmailProvider(
    providerId: string,
    userId: string,
    maxMessages = 25,
  ): Promise<{ imported: number }> {
    const provider = await this.emailProviderRepo.findOne({
      where: { id: providerId, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.type !== 'GMAIL')
      throw new BadRequestException('Provider is not Gmail');

    const accessToken = await this.ensureFreshGmailAccessToken(provider);

    this.logger.log(
      `Starting Gmail sync provider=${providerId} user=${userId} maxMessages=${maxMessages}`,
    );
    await this.emailProviderRepo.update(
      { id: providerId },
      {
        status: 'syncing',
        lastSyncError: null,
        lastSyncErrorAt: null,
      },
    );

    try {
      await this.ensureGmailPushWatch({
        provider,
        accessToken,
      });

      // Best-effort label metadata sync (for UI label rendering).
      await this.syncGmailLabels(providerId, userId, accessToken);

      const syncBatch = await this.listMessageIdsForSync({
        accessToken,
        maxMessages,
        startHistoryId: provider.gmailHistoryId || null,
      });
      const ids = syncBatch.ids;
      let imported = 0;

      for (const msg of ids) {
        try {
          const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(msg.id)}`;
          const details = await axios.get<GmailMessageResponse>(msgUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            },
          });

          const headers = details.data.payload?.headers || [];
          const get = (name: string) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
              ?.value;
          const from = get('From') || null;
          const toRaw = get('To') || '';
          const to = toRaw
            ? toRaw
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
          const subject = get('Subject') || null;
          const internalDate = details.data.internalDate
            ? new Date(Number(details.data.internalDate))
            : null;
          const labels = details.data.labelIds || [];

          await this.externalEmailMessageRepo.upsert(
            [
              {
                userId,
                providerId,
                externalMessageId: details.data.id,
                threadId: details.data.threadId || msg.threadId || undefined,
                from: from || undefined,
                to,
                subject: subject || undefined,
                snippet: details.data.snippet || undefined,
                internalDate: internalDate || undefined,
                labels,
                rawPayload: details.data as any,
              },
            ],
            ['providerId', 'externalMessageId'],
          );

          imported += 1;
        } catch (e: any) {
          this.logger.warn(
            `Failed to import message ${msg.id}: ${e?.message || e}`,
          );
        }
      }

      const latestHistoryId =
        syncBatch.historyId ||
        (await this.getLatestGmailHistoryId(accessToken));

      await this.emailProviderRepo.update(
        { id: providerId },
        {
          lastSyncedAt: new Date(),
          status: 'connected',
          gmailHistoryId: latestHistoryId || provider.gmailHistoryId,
          syncLeaseExpiresAt: null,
          lastSyncError: null,
          lastSyncErrorAt: null,
        },
      );

      this.logger.log(
        `Finished Gmail sync provider=${providerId} mode=${syncBatch.mode} imported=${imported} historyId=${latestHistoryId || 'n/a'}`,
      );
      return { imported };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Gmail sync failed provider=${providerId} user=${userId}: ${message}`,
      );
      await this.emailProviderRepo.update(
        { id: providerId },
        {
          status: 'error',
          syncLeaseExpiresAt: null,
          lastSyncError: message.slice(0, 500),
          lastSyncErrorAt: new Date(),
        },
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to sync Gmail provider');
    }
  }

  async listInboxMessagesForProvider(
    providerId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ) {
    // Ownership validation by join through provider
    const provider = await this.emailProviderRepo.findOne({
      where: { id: providerId, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const msgs = await this.externalEmailMessageRepo.find({
      where: { providerId, userId },
      order: { internalDate: 'DESC', createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return msgs.map((m) => ({
      id: m.id,
      providerId: m.providerId,
      externalMessageId: m.externalMessageId,
      threadId: m.threadId || undefined,
      from: m.from || undefined,
      to: m.to,
      subject: m.subject || undefined,
      snippet: m.snippet || undefined,
      internalDate: m.internalDate ? m.internalDate.toISOString() : undefined,
      labels: m.labels,
    }));
  }
}
