/**
 * File:        core/infrastructure/external-services/push/push-notification.gateway.ts
 * Module:      Infrastructure - External Services
 * Purpose:     No-op push gateway stub. Replace with FCM/APNS adapter in production.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Logger } from '@nestjs/common';
import { IPushGateway, PushPayload } from '../../../application/ports/gateways/push.gateway';

@Injectable()
export class PushNotificationGateway implements IPushGateway {
  private readonly logger = new Logger(PushNotificationGateway.name);

  async send(payload: PushPayload): Promise<{ delivered: boolean; reason?: string }> {
    this.logger.log(`[PUSH-STUB] userId=${payload.userId} title="${payload.title}"`);
    return { delivered: false, reason: 'push-not-configured' };
  }
}
