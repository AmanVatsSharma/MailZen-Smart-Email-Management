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
import { GmailSyncService } from './gmail-sync.service';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

type GmailPushWebhookEnvelope = {
  message?: {
    data?: string;
    messageId?: string;
  };
};

type GmailPushPayload = {
  emailAddress?: string;
  historyId?: string;
};

@Controller('gmail-sync/webhooks')
export class GmailSyncWebhookController {
  private readonly logger = new Logger(GmailSyncWebhookController.name);

  constructor(private readonly gmailSyncService: GmailSyncService) {}

  private assertWebhookToken(input: {
    requestId: string;
    token?: string;
  }): void {
    const expectedToken = String(
      process.env.GMAIL_PUSH_WEBHOOK_TOKEN || '',
    ).trim();
    if (!expectedToken) return;
    const inboundToken = String(input.token || '').trim();
    if (!inboundToken) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'gmail_push_webhook_secret_missing',
          requestId: input.requestId,
        }),
      );
      throw new UnauthorizedException('Invalid Gmail push webhook token');
    }
    if (inboundToken.length !== expectedToken.length) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'gmail_push_webhook_secret_mismatch',
          requestId: input.requestId,
          inboundLength: inboundToken.length,
          expectedLength: expectedToken.length,
        }),
      );
      throw new UnauthorizedException('Invalid Gmail push webhook token');
    }
    const matches = timingSafeEqual(
      Buffer.from(inboundToken),
      Buffer.from(expectedToken),
    );
    if (matches) return;
    this.logger.warn(
      serializeStructuredLog({
        event: 'gmail_push_webhook_secret_mismatch',
        requestId: input.requestId,
        inboundLength: inboundToken.length,
        expectedLength: expectedToken.length,
      }),
    );
    throw new UnauthorizedException('Invalid Gmail push webhook token');
  }

  private decodePushPayload(
    envelope: GmailPushWebhookEnvelope,
  ): GmailPushPayload {
    const encodedData = String(envelope.message?.data || '').trim();
    if (!encodedData) {
      throw new BadRequestException('Gmail push webhook message data missing');
    }

    let decodedData = '';
    try {
      decodedData = Buffer.from(encodedData, 'base64').toString('utf8');
    } catch {
      throw new BadRequestException('Invalid Gmail push webhook data encoding');
    }

    let payload: GmailPushPayload = {};
    try {
      payload = JSON.parse(decodedData) as GmailPushPayload;
    } catch {
      throw new BadRequestException('Invalid Gmail push webhook data payload');
    }

    const emailAddress = String(payload.emailAddress || '')
      .trim()
      .toLowerCase();
    if (!emailAddress) {
      throw new BadRequestException('Gmail push payload emailAddress missing');
    }

    return {
      emailAddress,
      historyId: String(payload.historyId || '').trim() || undefined,
    };
  }

  @Post('push')
  @HttpCode(202)
  async handlePushWebhook(
    @Body() body: GmailPushWebhookEnvelope,
    @Query('token') token?: string,
    @Headers('x-request-id') requestIdHeader?: string,
  ) {
    const requestId = resolveCorrelationId(requestIdHeader);
    this.assertWebhookToken({
      token,
      requestId,
    });
    const payload = this.decodePushPayload(body);
    const result = await this.gmailSyncService.processPushNotification({
      emailAddress: payload.emailAddress || '',
      historyId: payload.historyId || null,
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'gmail_push_webhook_processed',
        requestId,
        accountFingerprint: payload.emailAddress
          ? fingerprintIdentifier(payload.emailAddress)
          : null,
        historyId: payload.historyId || null,
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
