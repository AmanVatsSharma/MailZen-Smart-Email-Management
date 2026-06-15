/**
 * File:        core/testing/fake-mail.gateway.ts
 * Module:      Testing
 * Purpose:     In-memory implementation of IMailGateway for use case specs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IMailGateway, OutgoingMail } from 'application/ports/gateways/mail.gateway';
import { Result } from '../domain/shared/result';

export class FakeMailGateway implements IMailGateway {
  public sent: OutgoingMail[] = [];

  async send(mail: OutgoingMail): Promise<Result<{ providerMessageId: string }, Error>> {
    this.sent.push(mail);
    return Result.ok({ providerMessageId: `msg_${this.sent.length}` });
  }

  // Test helper
  clear(): void {
    this.sent = [];
  }
}