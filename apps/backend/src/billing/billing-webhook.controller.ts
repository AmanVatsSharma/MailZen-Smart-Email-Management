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
import { timingSafeEqual } from 'crypto';
import { BillingService } from './billing.service';
import {
  fingerprintIdentifier,
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

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

  private validateWebhookSecret(input: {
    provider: string;
    requestId: string;
    inboundSecret?: string;
  }): void {
    const configuredSecret = this.normalizeString(
      process.env.BILLING_WEBHOOK_SHARED_SECRET,
    );
    if (!configuredSecret) return;
    const inboundSecret = this.normalizeString(input.inboundSecret);
    if (!inboundSecret) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'billing_webhook_secret_missing',
          requestId: input.requestId,
          provider: input.provider,
        }),
      );
      throw new UnauthorizedException('Billing webhook secret mismatch');
    }
    if (inboundSecret.length !== configuredSecret.length) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'billing_webhook_secret_mismatch',
          requestId: input.requestId,
          provider: input.provider,
          inboundLength: inboundSecret.length,
          expectedLength: configuredSecret.length,
        }),
      );
      throw new UnauthorizedException('Billing webhook secret mismatch');
    }
    const matches = timingSafeEqual(
      Buffer.from(inboundSecret),
      Buffer.from(configuredSecret),
    );
    if (matches) return;
    this.logger.warn(
      serializeStructuredLog({
        event: 'billing_webhook_secret_mismatch',
        requestId: input.requestId,
        provider: input.provider,
        inboundLength: inboundSecret.length,
        expectedLength: configuredSecret.length,
      }),
    );
    throw new UnauthorizedException('Billing webhook secret mismatch');
  }

  @Post(':provider')
  async ingestWebhook(
    @Param('provider') provider: string,
    @Body() payload: BillingWebhookBody,
    @Headers('x-billing-webhook-secret') webhookSecret?: string,
    @Headers('x-request-id') requestIdHeader?: string,
  ): Promise<{
    accepted: boolean;
    status: string;
    eventId: string;
    externalEventId: string;
  }> {
    const requestId = resolveCorrelationId(requestIdHeader);
    this.validateWebhookSecret({
      provider,
      inboundSecret: webhookSecret,
      requestId,
    });

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
      serializeStructuredLog({
        event: 'billing_webhook_ingested',
        requestId,
        provider,
        eventType,
        externalEventIdFingerprint: fingerprintIdentifier(externalEventId),
        status: event.status,
      }),
    );

    return {
      accepted: event.status === 'processed',
      status: event.status,
      eventId: event.id,
      externalEventId: event.externalEventId,
    };
  }
}
