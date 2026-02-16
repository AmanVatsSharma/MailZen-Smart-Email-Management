import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  resolveProviderSecretsKeyring,
  ProviderSecretsKeyring,
} from '../common/provider-secrets.util';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';

type OutlookRecipient = {
  emailAddress?: {
    name?: string;
    address?: string;
  };
};

type OutlookMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  from?: OutlookRecipient;
  toRecipients?: OutlookRecipient[];
  categories?: string[];
  '@removed'?: {
    reason?: string;
  };
};

type OutlookMessagesResponse = {
  value?: OutlookMessage[];
};

type OutlookDeltaResponse = OutlookMessagesResponse & {
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
};

type OutlookSubscriptionResponse = {
  id?: string;
  expirationDateTime?: string;
};

@Injectable()
export class OutlookSyncService {
  private readonly logger = new Logger(OutlookSyncService.name);
  private readonly providerSecretsKeyring: ProviderSecretsKeyring;
  private static readonly OUTLOOK_SELECT_FIELDS =
    'id,conversationId,subject,bodyPreview,receivedDateTime,isRead,from,toRecipients,categories';

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
  }

  private resolvePushSyncMaxMessages(): number {
    const parsedValue = Number(
      process.env.OUTLOOK_PUSH_SYNC_MAX_MESSAGES || 25,
    );
    const candidate = Number.isFinite(parsedValue)
      ? Math.floor(parsedValue)
      : 25;
    if (candidate < 1) return 1;
    if (candidate > 200) return 200;
    return candidate;
  }

  private resolveDeltaPageLimit(): number {
    const rawValue = Number(process.env.OUTLOOK_SYNC_DELTA_PAGE_LIMIT || 5);
    if (!Number.isFinite(rawValue)) return 5;
    const normalized = Math.floor(rawValue);
    if (normalized < 1) return 1;
    if (normalized > 20) return 20;
    return normalized;
  }

  private isPushSubscriptionEnabled(): boolean {
    return Boolean(
      String(process.env.OUTLOOK_PUSH_NOTIFICATION_URL || '').trim(),
    );
  }

  private resolvePushSubscriptionDurationMinutes(): number {
    const parsedValue = Number(
      process.env.OUTLOOK_PUSH_SUBSCRIPTION_DURATION_MINUTES || 2880,
    );
    const candidate = Number.isFinite(parsedValue)
      ? Math.floor(parsedValue)
      : 2880;
    if (candidate < 5) return 5;
    if (candidate > 4230) return 4230;
    return candidate;
  }

  private resolvePushSubscriptionRenewThresholdMinutes(): number {
    const parsedValue = Number(
      process.env.OUTLOOK_PUSH_SUBSCRIPTION_RENEW_THRESHOLD_MINUTES || 120,
    );
    const candidate = Number.isFinite(parsedValue)
      ? Math.floor(parsedValue)
      : 120;
    if (candidate < 1) return 1;
    if (candidate > 24 * 60) return 24 * 60;
    return candidate;
  }

  private resolvePushClientState(provider: EmailProvider): string {
    const secret = String(process.env.OUTLOOK_PUSH_CLIENT_STATE_SECRET || '')
      .trim()
      .toLowerCase();
    if (!secret) return provider.id;
    return `${provider.id}:${secret}`;
  }

  private shouldRefreshPushSubscription(provider: EmailProvider): boolean {
    const thresholdMinutes =
      this.resolvePushSubscriptionRenewThresholdMinutes();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const expirationMs = provider.outlookPushSubscriptionExpiresAt
      ? new Date(provider.outlookPushSubscriptionExpiresAt).getTime()
      : 0;
    if (!expirationMs) return true;
    return expirationMs <= Date.now() + thresholdMs;
  }

  private async ensureOutlookPushSubscription(input: {
    provider: EmailProvider;
    accessToken: string;
  }): Promise<void> {
    if (!this.isPushSubscriptionEnabled()) return;
    if (!this.shouldRefreshPushSubscription(input.provider)) return;
    const notificationUrl = String(
      process.env.OUTLOOK_PUSH_NOTIFICATION_URL || '',
    ).trim();
    if (!notificationUrl) return;

    const expirationDateTime = new Date(
      Date.now() + this.resolvePushSubscriptionDurationMinutes() * 60 * 1000,
    ).toISOString();
    const authHeaders = { Authorization: `Bearer ${input.accessToken}` };

    if (input.provider.outlookPushSubscriptionId) {
      try {
        const renewResponse = await axios.patch<OutlookSubscriptionResponse>(
          `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(input.provider.outlookPushSubscriptionId)}`,
          {
            expirationDateTime,
          },
          {
            headers: authHeaders,
          },
        );
        const renewedExpiration = renewResponse.data.expirationDateTime
          ? new Date(renewResponse.data.expirationDateTime)
          : new Date(expirationDateTime);
        await this.emailProviderRepo.update(
          { id: input.provider.id },
          {
            outlookPushSubscriptionExpiresAt: renewedExpiration,
            outlookPushSubscriptionLastRenewedAt: new Date(),
          },
        );
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          serializeStructuredLog({
            event: 'outlook_sync_subscription_renew_failed_fallback_create',
            providerId: input.provider.id,
            error: message,
          }),
        );
      }
    }

    try {
      const createResponse = await axios.post<OutlookSubscriptionResponse>(
        'https://graph.microsoft.com/v1.0/subscriptions',
        {
          changeType: 'created,updated,deleted',
          notificationUrl,
          resource: '/me/messages',
          expirationDateTime,
          clientState: this.resolvePushClientState(input.provider),
        },
        {
          headers: authHeaders,
        },
      );
      const createdSubscriptionId = String(createResponse.data.id || '').trim();
      const createdExpiration = createResponse.data.expirationDateTime
        ? new Date(createResponse.data.expirationDateTime)
        : new Date(expirationDateTime);
      await this.emailProviderRepo.update(
        { id: input.provider.id },
        {
          outlookPushSubscriptionId: createdSubscriptionId || undefined,
          outlookPushSubscriptionExpiresAt: createdExpiration,
          outlookPushSubscriptionLastRenewedAt: new Date(),
        },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        serializeStructuredLog({
          event: 'outlook_sync_subscription_create_failed',
          providerId: input.provider.id,
          error: message,
        }),
      );
    }
  }

  private async ensureFreshOutlookAccessToken(provider: EmailProvider) {
    const decryptedAccessToken = provider.accessToken
      ? decryptProviderSecret(provider.accessToken, this.providerSecretsKeyring)
      : '';
    const decryptedRefreshToken = provider.refreshToken
      ? decryptProviderSecret(
          provider.refreshToken,
          this.providerSecretsKeyring,
        )
      : '';

    if (!decryptedAccessToken && !decryptedRefreshToken) {
      throw new BadRequestException(
        'Missing OAuth credentials for Outlook provider',
      );
    }

    if (!provider.tokenExpiry || !decryptedRefreshToken) {
      return decryptedAccessToken;
    }

    const nowMs = Date.now();
    const expiryMs = new Date(provider.tokenExpiry).getTime();
    if (expiryMs > nowMs + 5 * 60 * 1000 && decryptedAccessToken) {
      return decryptedAccessToken;
    }

    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Outlook OAuth not configured');
    }

    const tokenUrl =
      'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', decryptedRefreshToken);

    try {
      const tokenResponse = await axios.post<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      }>(tokenUrl, params, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });

      const nextAccessToken = tokenResponse.data.access_token;
      if (!nextAccessToken) {
        throw new Error('Outlook refresh did not return access token');
      }

      const expiresInSeconds = Number(tokenResponse.data.expires_in || 3600);
      const nextExpiry = new Date(Date.now() + expiresInSeconds * 1000);
      const nextRefreshToken =
        tokenResponse.data.refresh_token || decryptedRefreshToken;

      await this.emailProviderRepo.update(
        { id: provider.id },
        {
          accessToken: encryptProviderSecret(
            nextAccessToken,
            this.providerSecretsKeyring,
          ),
          refreshToken: encryptProviderSecret(
            nextRefreshToken,
            this.providerSecretsKeyring,
          ),
          tokenExpiry: nextExpiry,
        },
      );

      return nextAccessToken;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        serializeStructuredLog({
          event: 'outlook_sync_access_token_refresh_failed',
          providerId: provider.id,
          userId: provider.userId,
          error: message,
        }),
      );
      throw new InternalServerErrorException(
        'Failed to refresh Outlook access token',
      );
    }
  }

  private normalizeRecipientAddress(recipient?: OutlookRecipient): string {
    const name = recipient?.emailAddress?.name?.trim();
    const address = recipient?.emailAddress?.address?.trim();
    if (!address) return '';
    return name ? `${name} <${address}>` : address;
  }

  private normalizeLabels(message: OutlookMessage): string[] {
    const labels = new Set<string>();
    labels.add('INBOX');
    if (!message.isRead) labels.add('UNREAD');
    for (const category of message.categories || []) {
      const normalizedCategory = String(category || '').trim();
      if (!normalizedCategory) continue;
      labels.add(normalizedCategory);
    }
    return Array.from(labels);
  }

  private async upsertOutlookMessage(input: {
    userId: string;
    providerId: string;
    message: OutlookMessage;
  }): Promise<{ imported: boolean; categories: string[] }> {
    const messageId = String(input.message.id || '').trim();
    if (!messageId) {
      return { imported: false, categories: [] };
    }
    if (input.message['@removed']) {
      await this.externalEmailMessageRepo.delete({
        providerId: input.providerId,
        externalMessageId: messageId,
      });
      return { imported: false, categories: [] };
    }

    const from = this.normalizeRecipientAddress(input.message.from);
    const to = (input.message.toRecipients || [])
      .map((recipient) => this.normalizeRecipientAddress(recipient))
      .filter(Boolean);
    const labels = this.normalizeLabels(input.message);
    const categories = (input.message.categories || [])
      .map((categoryName) => String(categoryName || '').trim())
      .filter(Boolean);

    await this.externalEmailMessageRepo.upsert(
      [
        {
          userId: input.userId,
          providerId: input.providerId,
          externalMessageId: messageId,
          threadId: input.message.conversationId || undefined,
          from: from || undefined,
          to,
          subject: input.message.subject || undefined,
          snippet: input.message.bodyPreview || undefined,
          internalDate: input.message.receivedDateTime
            ? new Date(input.message.receivedDateTime)
            : undefined,
          labels,
        },
      ],
      ['providerId', 'externalMessageId'],
    );
    return { imported: true, categories };
  }

  private async runDeltaSync(input: {
    accessToken: string;
    providerId: string;
    userId: string;
    cursor: string;
    pageLimit: number;
  }): Promise<{
    imported: number;
    removed: number;
    categories: Set<string>;
    nextCursor: string;
  }> {
    let currentCursor = input.cursor;
    let imported = 0;
    let removed = 0;
    const categories = new Set<string>();
    const authHeaders = { Authorization: `Bearer ${input.accessToken}` };

    for (let page = 0; page < input.pageLimit; page += 1) {
      const response = await axios.get<OutlookDeltaResponse>(currentCursor, {
        headers: authHeaders,
      });
      const messages = response.data.value || [];

      for (const message of messages) {
        const hasRemovedMarker = Boolean(message['@removed']);
        const result = await this.upsertOutlookMessage({
          userId: input.userId,
          providerId: input.providerId,
          message,
        });
        if (result.imported) imported += 1;
        if (hasRemovedMarker) removed += 1;
        for (const categoryName of result.categories) {
          categories.add(categoryName);
        }
      }

      const deltaLink = response.data['@odata.deltaLink'];
      const nextLink = response.data['@odata.nextLink'];
      currentCursor = String(deltaLink || nextLink || currentCursor);
      if (!nextLink) break;
    }

    return {
      imported,
      removed,
      categories,
      nextCursor: currentCursor,
    };
  }

  private async bootstrapDeltaCursor(input: {
    accessToken: string;
    maxMessages: number;
    pageLimit: number;
  }): Promise<string | null> {
    const authHeaders = { Authorization: `Bearer ${input.accessToken}` };
    let cursorUrl = 'https://graph.microsoft.com/v1.0/me/messages/delta';
    let requestParams:
      | {
          $top: number;
          $select: string;
        }
      | undefined = {
      $top: input.maxMessages,
      $select: OutlookSyncService.OUTLOOK_SELECT_FIELDS,
    };
    let latestCursor: string | null = null;

    for (let page = 0; page < input.pageLimit; page += 1) {
      const response = await axios.get<OutlookDeltaResponse>(cursorUrl, {
        headers: authHeaders,
        params: requestParams,
      });
      const deltaLink = String(response.data['@odata.deltaLink'] || '').trim();
      const nextLink = String(response.data['@odata.nextLink'] || '').trim();
      if (deltaLink) return deltaLink;
      if (!nextLink) break;

      latestCursor = nextLink;
      cursorUrl = nextLink;
      requestParams = undefined;
    }

    return latestCursor;
  }

  async processPushNotification(input: {
    providerId?: string | null;
    emailAddress?: string | null;
  }): Promise<{ processedProviders: number; skippedProviders: number }> {
    const normalizedProviderId = String(input.providerId || '').trim();
    const normalizedEmailAddress = String(input.emailAddress || '')
      .trim()
      .toLowerCase();
    if (!normalizedProviderId && !normalizedEmailAddress) {
      throw new BadRequestException(
        'Outlook push notification requires providerId or emailAddress',
      );
    }

    const providers: EmailProvider[] = normalizedProviderId
      ? []
      : await this.emailProviderRepo.find({
          where: {
            type: 'OUTLOOK',
            isActive: true,
            email: normalizedEmailAddress,
          },
        });
    if (normalizedProviderId) {
      const provider = await this.emailProviderRepo.findOne({
        where: {
          id: normalizedProviderId,
          type: 'OUTLOOK',
          isActive: true,
        },
      });
      if (provider) {
        providers.push(provider);
      }
    }
    if (!providers.length) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'outlook_push_notification_ignored_no_provider',
          providerId: normalizedProviderId || null,
          accountFingerprint: normalizedEmailAddress
            ? fingerprintIdentifier(normalizedEmailAddress)
            : null,
        }),
      );
      return { processedProviders: 0, skippedProviders: 0 };
    }

    const maxMessages = this.resolvePushSyncMaxMessages();
    let processedProviders = 0;
    let skippedProviders = 0;

    for (const provider of providers) {
      const leaseAcquired =
        await this.providerSyncLease.acquireProviderSyncLease({
          providerId: provider.id,
          providerType: 'OUTLOOK',
        });
      if (!leaseAcquired) {
        skippedProviders += 1;
        continue;
      }

      try {
        await this.syncOutlookProvider(
          provider.id,
          provider.userId,
          maxMessages,
        );
        processedProviders += 1;
      } catch (error: unknown) {
        skippedProviders += 1;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          serializeStructuredLog({
            event: 'outlook_push_notification_provider_failed',
            providerId: provider.id,
            error: errorMessage,
          }),
        );
      }
    }

    return { processedProviders, skippedProviders };
  }

  async ensurePushSubscriptionForProvider(
    providerId: string,
    userId: string,
  ): Promise<boolean> {
    const provider = await this.emailProviderRepo.findOne({
      where: {
        id: providerId,
        userId,
      },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.type !== 'OUTLOOK') {
      throw new BadRequestException('Provider is not Outlook');
    }
    const accessToken = await this.ensureFreshOutlookAccessToken(provider);
    await this.ensureOutlookPushSubscription({
      provider,
      accessToken,
    });
    return true;
  }

  private async syncLabelMetadata(input: {
    userId: string;
    providerId: string;
    categoryNames: string[];
  }): Promise<void> {
    const systemLabels = ['INBOX', 'UNREAD'];
    const labelsToUpsert: Array<Partial<ExternalEmailLabel>> = [
      ...systemLabels.map((name) => ({
        userId: input.userId,
        providerId: input.providerId,
        externalLabelId: name,
        name,
        type: 'system',
        isSystem: true,
      })),
      ...input.categoryNames.map((categoryName) => ({
        userId: input.userId,
        providerId: input.providerId,
        externalLabelId: categoryName,
        name: categoryName,
        type: 'user',
        isSystem: false,
      })),
    ];

    await this.externalEmailLabelRepo.upsert(labelsToUpsert, [
      'providerId',
      'externalLabelId',
    ]);
  }

  async syncOutlookProvider(
    providerId: string,
    userId: string,
    maxMessages = 25,
  ): Promise<{ imported: number }> {
    const syncCorrelationId = resolveCorrelationId(undefined);
    const syncStartedAtMs = Date.now();
    const provider = await this.emailProviderRepo.findOne({
      where: { id: providerId, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.type !== 'OUTLOOK') {
      throw new BadRequestException('Provider is not Outlook');
    }

    const accessToken = await this.ensureFreshOutlookAccessToken(provider);
    if (!accessToken) {
      throw new InternalServerErrorException(
        'Could not obtain Outlook access token',
      );
    }
    this.logger.log(
      serializeStructuredLog({
        event: 'outlook_sync_start',
        providerId,
        userId,
        maxMessages,
        syncCorrelationId,
        currentCursorPresent: Boolean(provider.outlookSyncCursor),
      }),
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
      await this.ensureOutlookPushSubscription({
        provider,
        accessToken,
      });

      const normalizedMaxMessages = Math.max(1, Math.min(100, maxMessages));
      const deltaPageLimit = this.resolveDeltaPageLimit();
      const providerCursor = String(provider.outlookSyncCursor || '').trim();
      let imported = 0;
      let removed = 0;
      const categorySet = new Set<string>();
      let nextCursor: string | null = providerCursor || null;
      let shouldRunFullSync = !providerCursor;

      if (providerCursor) {
        this.logger.log(
          serializeStructuredLog({
            event: 'outlook_sync_incremental_start',
            providerId,
            userId,
            syncCorrelationId,
            pageLimit: deltaPageLimit,
          }),
        );
        try {
          const deltaSyncResult = await this.runDeltaSync({
            accessToken,
            providerId,
            userId,
            cursor: providerCursor,
            pageLimit: deltaPageLimit,
          });
          imported = deltaSyncResult.imported;
          removed = deltaSyncResult.removed;
          nextCursor = deltaSyncResult.nextCursor;
          for (const categoryName of deltaSyncResult.categories) {
            categorySet.add(categoryName);
          }
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            serializeStructuredLog({
              event: 'outlook_sync_incremental_fallback',
              providerId,
              userId,
              syncCorrelationId,
              reason: message,
            }),
          );
          shouldRunFullSync = true;
          nextCursor = null;
        }
      }

      if (shouldRunFullSync) {
        const response = await axios.get<OutlookMessagesResponse>(
          'https://graph.microsoft.com/v1.0/me/messages',
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
              $top: normalizedMaxMessages,
              $orderby: 'receivedDateTime desc',
              $select: OutlookSyncService.OUTLOOK_SELECT_FIELDS,
            },
          },
        );
        const messages = response.data.value || [];

        for (const message of messages) {
          const result = await this.upsertOutlookMessage({
            userId,
            providerId,
            message,
          });
          if (result.imported) imported += 1;
          for (const categoryName of result.categories) {
            categorySet.add(categoryName);
          }
        }

        nextCursor = await this.bootstrapDeltaCursor({
          accessToken,
          maxMessages: normalizedMaxMessages,
          pageLimit: deltaPageLimit,
        });
      }

      await this.syncLabelMetadata({
        userId,
        providerId,
        categoryNames: Array.from(categorySet),
      });

      await this.emailProviderRepo.update(
        { id: providerId },
        {
          status: 'connected',
          lastSyncedAt: new Date(),
          syncLeaseExpiresAt: null,
          lastSyncError: null,
          lastSyncErrorAt: null,
          outlookSyncCursor: nextCursor,
        },
      );

      this.logger.log(
        serializeStructuredLog({
          event: 'outlook_sync_completed',
          providerId,
          userId,
          syncCorrelationId,
          importedMessages: imported,
          removedMessages: removed,
          cursorPresent: Boolean(nextCursor),
          durationMs: Date.now() - syncStartedAtMs,
        }),
      );
      return { imported };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        serializeStructuredLog({
          event: 'outlook_sync_failed',
          providerId,
          userId,
          syncCorrelationId,
          error: message,
          durationMs: Date.now() - syncStartedAtMs,
        }),
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
      throw new InternalServerErrorException('Failed to sync Outlook provider');
    }
  }
}
