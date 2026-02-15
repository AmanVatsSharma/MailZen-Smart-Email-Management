import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { BillingService } from './billing.service';

interface BillingWebhookBody {
  id?: unknown;
  eventId?: unknown;
  externalEventId?: unknown;
  type?: unknown;
  eventType?: unknown;
  [key: string]: unknown;
}

@Controller('billing/webhooks')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(private readonly billingService: BillingService) {}

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized || undefined;
  }

  private validateWebhookSecret(inboundSecret?: string): void {
    const configuredSecret = this.normalizeString(
      process.env.BILLING_WEBHOOK_SHARED_SECRET,
    );
    if (!configuredSecret) return;
    if (this.normalizeString(inboundSecret) === configuredSecret) return;
    throw new UnauthorizedException('Billing webhook secret mismatch');
  }

  @Post(':provider')
  async ingestWebhook(
    @Param('provider') provider: string,
    @Body() payload: BillingWebhookBody,
    @Headers('x-billing-webhook-secret') webhookSecret?: string,
  ): Promise<{
    accepted: boolean;
    status: string;
    eventId: string;
    externalEventId: string;
  }> {
    this.validateWebhookSecret(webhookSecret);

    const eventType =
      this.normalizeString(payload.type) ||
      this.normalizeString(payload.eventType);
    const externalEventId =
      this.normalizeString(payload.id) ||
      this.normalizeString(payload.eventId) ||
      this.normalizeString(payload.externalEventId);

    if (!eventType) {
      throw new BadRequestException(
        'Billing webhook payload requires type or eventType',
      );
    }
    if (!externalEventId) {
      throw new BadRequestException(
        'Billing webhook payload requires id/eventId/externalEventId',
      );
    }

    const event = await this.billingService.ingestBillingWebhook({
      provider,
      eventType,
      externalEventId,
      payloadJson: JSON.stringify(payload || {}),
    });

    this.logger.log(
      `billing-webhook: provider=${provider} eventType=${eventType} externalEventId=${externalEventId} status=${event.status}`,
    );

    return {
      accepted: event.status === 'processed',
      status: event.status,
      eventId: event.id,
      externalEventId: event.externalEventId,
    };
  }
}
