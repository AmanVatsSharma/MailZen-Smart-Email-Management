import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { OutlookSyncService } from './outlook-sync.service';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

type OutlookWebhookPayload = {
  providerId?: string;
  emailAddress?: string;
  userPrincipalName?: string;
  clientState?: string;
  value?: Array<{
    providerId?: string;
    clientState?: string;
    emailAddress?: string;
    userPrincipalName?: string;
    resourceData?: {
      clientState?: string;
      emailAddress?: string;
      userPrincipalName?: string;
    };
  }>;
};

@Controller('outlook-sync/webhooks')
export class OutlookSyncWebhookController {
  private readonly logger = new Logger(OutlookSyncWebhookController.name);

  constructor(private readonly outlookSyncService: OutlookSyncService) {}

  private assertWebhookToken(input: {
    requestId: string;
    token?: string;
  }): void {
    const expectedToken = String(
      process.env.OUTLOOK_PUSH_WEBHOOK_TOKEN || '',
    ).trim();
    if (!expectedToken) return;
    const inboundToken = String(input.token || '').trim();
    if (!inboundToken) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'outlook_push_webhook_secret_missing',
          requestId: input.requestId,
        }),
      );
      throw new UnauthorizedException('Invalid Outlook push webhook token');
    }
    if (inboundToken.length !== expectedToken.length) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'outlook_push_webhook_secret_mismatch',
          requestId: input.requestId,
          inboundLength: inboundToken.length,
          expectedLength: expectedToken.length,
        }),
      );
      throw new UnauthorizedException('Invalid Outlook push webhook token');
    }
    const matches = timingSafeEqual(
      Buffer.from(inboundToken),
      Buffer.from(expectedToken),
    );
    if (matches) return;
    this.logger.warn(
      serializeStructuredLog({
        event: 'outlook_push_webhook_secret_mismatch',
        requestId: input.requestId,
        inboundLength: inboundToken.length,
        expectedLength: expectedToken.length,
      }),
    );
    throw new UnauthorizedException('Invalid Outlook push webhook token');
  }

  private resolveProviderId(
    queryProviderId: string | undefined,
    payload: OutlookWebhookPayload,
  ): string | null {
    const directProviderId = String(
      queryProviderId || payload.providerId || '',
    ).trim();
    if (directProviderId) return directProviderId;

    for (const event of payload.value || []) {
      const providerId = String(event.providerId || '').trim();
      if (providerId) return providerId;
    }
    return null;
  }

  private resolveEmailAddress(payload: OutlookWebhookPayload): string | null {
    const directEmail = String(
      payload.emailAddress || payload.userPrincipalName || '',
    )
      .trim()
      .toLowerCase();
    if (directEmail) return directEmail;

    for (const event of payload.value || []) {
      const eventEmail = String(
        event.emailAddress ||
          event.userPrincipalName ||
          event.resourceData?.emailAddress ||
          event.resourceData?.userPrincipalName ||
          '',
      )
        .trim()
        .toLowerCase();
      if (eventEmail) return eventEmail;
    }
    return null;
  }

  private resolveClientStateSecret(): string | null {
    const configuredSecret = String(
      process.env.OUTLOOK_PUSH_CLIENT_STATE_SECRET || '',
    )
      .trim()
      .toLowerCase();
    if (!configuredSecret) return null;
    return configuredSecret;
  }

  private resolveClientStates(payload: OutlookWebhookPayload): string[] {
    const states = new Set<string>();
    const addCandidate = (value: string | undefined) => {
      const normalizedValue = String(value || '').trim();
      if (!normalizedValue) return;
      states.add(normalizedValue);
    };
    addCandidate(payload.clientState);
    for (const event of payload.value || []) {
      addCandidate(event.clientState);
      addCandidate(event.resourceData?.clientState);
    }
    return Array.from(states);
  }

  private resolveKnownProviderIds(input: {
    queryProviderId?: string;
    resolvedProviderId?: string | null;
    payload: OutlookWebhookPayload;
  }): string[] {
    const providerIds = new Set<string>();
    const addProviderId = (value: string | null | undefined) => {
      const normalizedValue = String(value || '').trim();
      if (!normalizedValue) return;
      providerIds.add(normalizedValue);
    };
    addProviderId(input.queryProviderId);
    addProviderId(input.resolvedProviderId);
    addProviderId(input.payload.providerId);
    for (const event of input.payload.value || []) {
      addProviderId(event.providerId);
    }
    return Array.from(providerIds);
  }

  private assertWebhookClientState(input: {
    requestId: string;
    payload: OutlookWebhookPayload;
    queryProviderId?: string;
    resolvedProviderId?: string | null;
  }): void {
    const expectedSecret = this.resolveClientStateSecret();
    if (!expectedSecret) return;

    const clientStates = this.resolveClientStates(input.payload);
    if (!clientStates.length) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'outlook_push_webhook_client_state_missing',
          requestId: input.requestId,
          providerId: input.resolvedProviderId || null,
        }),
      );
      throw new UnauthorizedException(
        'Invalid Outlook push webhook client state',
      );
    }

    const knownProviderIds = this.resolveKnownProviderIds({
      queryProviderId: input.queryProviderId,
      resolvedProviderId: input.resolvedProviderId,
      payload: input.payload,
    });
    const hasMatchingState = knownProviderIds.length
      ? knownProviderIds.some((providerId) =>
          clientStates.includes(`${providerId}:${expectedSecret}`),
        )
      : clientStates.some((clientState) =>
          clientState.endsWith(`:${expectedSecret}`),
        );
    if (hasMatchingState) return;

    this.logger.warn(
      serializeStructuredLog({
        event: 'outlook_push_webhook_client_state_mismatch',
        requestId: input.requestId,
        providerId: input.resolvedProviderId || null,
        knownProviderCount: knownProviderIds.length,
        providedClientStateCount: clientStates.length,
        firstClientStateFingerprint: fingerprintIdentifier(clientStates[0]),
      }),
    );
    throw new UnauthorizedException(
      'Invalid Outlook push webhook client state',
    );
  }

  @Post('push')
  @HttpCode(202)
  async handlePushWebhook(
    @Body() body: OutlookWebhookPayload,
    @Query('token') token?: string,
    @Query('providerId') providerId?: string,
    @Headers('x-request-id') requestIdHeader?: string,
  ) {
    const requestId = resolveCorrelationId(requestIdHeader);
    this.assertWebhookToken({
      token,
      requestId,
    });
    const resolvedProviderId = this.resolveProviderId(providerId, body);
    const resolvedEmailAddress = this.resolveEmailAddress(body);
    if (!resolvedProviderId && !resolvedEmailAddress) {
      throw new BadRequestException(
        'Outlook push payload must include providerId or emailAddress',
      );
    }
    this.assertWebhookClientState({
      requestId,
      payload: body,
      queryProviderId: providerId,
      resolvedProviderId,
    });

    const result = await this.outlookSyncService.processPushNotification({
      providerId: resolvedProviderId,
      emailAddress: resolvedEmailAddress,
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'outlook_push_webhook_processed',
        requestId,
        providerId: resolvedProviderId || null,
        accountFingerprint: resolvedEmailAddress
          ? fingerprintIdentifier(resolvedEmailAddress)
          : null,
        processedProviders: result.processedProviders,
        skippedProviders: result.skippedProviders,
      }),
    );
    return {
      accepted: true,
      ...result,
    };
  }
}
