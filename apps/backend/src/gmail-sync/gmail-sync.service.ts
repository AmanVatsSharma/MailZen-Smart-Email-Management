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
      ? decryptProviderSecret(provider.refreshToken, this.providerSecretsKeyring)
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
      { status: 'syncing' },
    );

    try {
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
        syncBatch.historyId || (await this.getLatestGmailHistoryId(accessToken));

      await this.emailProviderRepo.update(
        { id: providerId },
        {
          lastSyncedAt: new Date(),
          status: 'connected',
          gmailHistoryId: latestHistoryId || provider.gmailHistoryId,
          syncLeaseExpiresAt: null,
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
