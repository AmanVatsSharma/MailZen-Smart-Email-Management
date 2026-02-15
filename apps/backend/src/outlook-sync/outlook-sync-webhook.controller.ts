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
import { OutlookSyncService } from './outlook-sync.service';

type OutlookWebhookPayload = {
  providerId?: string;
  emailAddress?: string;
  userPrincipalName?: string;
  value?: Array<{
    providerId?: string;
    emailAddress?: string;
    userPrincipalName?: string;
    resourceData?: {
      emailAddress?: string;
      userPrincipalName?: string;
    };
  }>;
};

@Controller('outlook-sync/webhooks')
export class OutlookSyncWebhookController {
  private readonly logger = new Logger(OutlookSyncWebhookController.name);

  constructor(private readonly outlookSyncService: OutlookSyncService) {}

  private assertWebhookToken(token?: string): void {
    const expectedToken = String(
      process.env.OUTLOOK_PUSH_WEBHOOK_TOKEN || '',
    ).trim();
    if (!expectedToken) return;
    if (String(token || '').trim() === expectedToken) return;
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

  @Post('push')
  @HttpCode(202)
  async handlePushWebhook(
    @Body() body: OutlookWebhookPayload,
    @Query('token') token?: string,
    @Query('providerId') providerId?: string,
  ) {
    this.assertWebhookToken(token);
    const resolvedProviderId = this.resolveProviderId(providerId, body);
    const resolvedEmailAddress = this.resolveEmailAddress(body);
    if (!resolvedProviderId && !resolvedEmailAddress) {
      throw new BadRequestException(
        'Outlook push payload must include providerId or emailAddress',
      );
    }

    const result = await this.outlookSyncService.processPushNotification({
      providerId: resolvedProviderId,
      emailAddress: resolvedEmailAddress,
    });
    this.logger.log(
      `outlook-push: processed providerId=${resolvedProviderId || 'n/a'} email=${resolvedEmailAddress || 'n/a'} processed=${result.processedProviders} skipped=${result.skippedProviders}`,
    );
    return {
      accepted: true,
      ...result,
    };
  }
}
