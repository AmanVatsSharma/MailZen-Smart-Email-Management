/**
 * File:        core/infrastructure/external-services/sms/console-sms.gateway.ts
 * Module:      Infrastructure - External Services
 * Purpose:     Dev-mode SMS adapter that logs to stdout. In production, swap for
 *              Twilio or webhook adapter via composition/PlatformModule.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Logger } from '@nestjs/common';
import { ISmsGateway, SmsMessage } from '../../../application/ports/gateways/sms.gateway';

@Injectable()
export class ConsoleSmsGateway implements ISmsGateway {
  private readonly logger = new Logger(ConsoleSmsGateway.name);

  async send(message: SmsMessage): Promise<{ messageId: string }> {
    const messageId = crypto.randomUUID();
    this.logger.log(
      `[SMS-DEV] to=${message.to} body="${message.body}" messageId=${messageId}`,
    );
    return { messageId };
  }
}
