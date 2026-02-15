import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { GmailSyncService } from './gmail-sync.service';

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

  private assertWebhookToken(token?: string): void {
    const expectedToken = String(
      process.env.GMAIL_PUSH_WEBHOOK_TOKEN || '',
    ).trim();
    if (!expectedToken) return;
    if (String(token || '').trim() === expectedToken) return;
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
  ) {
    this.assertWebhookToken(token);
    const payload = this.decodePushPayload(body);
    const result = await this.gmailSyncService.processPushNotification({
      emailAddress: payload.emailAddress || '',
      historyId: payload.historyId || null,
    });
    this.logger.log(
      `gmail-push: processed email=${payload.emailAddress} processed=${result.processedProviders} skipped=${result.skippedProviders}`,
    );
    return {
      accepted: true,
      ...result,
    };
  }
}
