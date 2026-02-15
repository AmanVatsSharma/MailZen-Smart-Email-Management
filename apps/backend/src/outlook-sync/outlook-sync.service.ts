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
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';

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
};

type OutlookMessagesResponse = {
  value?: OutlookMessage[];
};

@Injectable()
export class OutlookSyncService {
  private readonly logger = new Logger(OutlookSyncService.name);
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
  }

  private async ensureFreshOutlookAccessToken(provider: EmailProvider) {
    const decryptedAccessToken = provider.accessToken
      ? decryptProviderSecret(provider.accessToken, this.providerSecretsKeyring)
      : '';
    const decryptedRefreshToken = provider.refreshToken
      ? decryptProviderSecret(provider.refreshToken, this.providerSecretsKeyring)
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
        `Failed to refresh Outlook access token for provider=${provider.id}: ${message}`,
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

    await this.emailProviderRepo.update(
      { id: providerId },
      { status: 'syncing' },
    );

    try {
      const response = await axios.get<OutlookMessagesResponse>(
        'https://graph.microsoft.com/v1.0/me/messages',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            $top: maxMessages,
            $orderby: 'receivedDateTime desc',
            $select:
              'id,conversationId,subject,bodyPreview,receivedDateTime,isRead,from,toRecipients,categories',
          },
        },
      );

      const messages = response.data.value || [];
      let imported = 0;
      const categorySet = new Set<string>();

      for (const message of messages) {
        if (!message.id) continue;
        const from = this.normalizeRecipientAddress(message.from);
        const to = (message.toRecipients || [])
          .map((recipient) => this.normalizeRecipientAddress(recipient))
          .filter(Boolean);
        const labels = this.normalizeLabels(message);
        for (const categoryName of message.categories || []) {
          if (categoryName?.trim()) categorySet.add(categoryName.trim());
        }

        await this.externalEmailMessageRepo.upsert(
          [
            {
              userId,
              providerId,
              externalMessageId: message.id,
              threadId: message.conversationId || undefined,
              from: from || undefined,
              to,
              subject: message.subject || undefined,
              snippet: message.bodyPreview || undefined,
              internalDate: message.receivedDateTime
                ? new Date(message.receivedDateTime)
                : undefined,
              labels,
            },
          ],
          ['providerId', 'externalMessageId'],
        );

        imported += 1;
      }

      await this.syncLabelMetadata({
        userId,
        providerId,
        categoryNames: Array.from(categorySet),
      });

      await this.emailProviderRepo.update(
        { id: providerId },
        { status: 'connected', lastSyncedAt: new Date() },
      );

      this.logger.log(
        `Finished Outlook sync provider=${providerId} imported=${imported}`,
      );
      return { imported };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Outlook sync failed provider=${providerId} user=${userId}: ${message}`,
      );
      await this.emailProviderRepo.update(
        { id: providerId },
        { status: 'error' },
      );
      throw new InternalServerErrorException('Failed to sync Outlook provider');
    }
  }
}
