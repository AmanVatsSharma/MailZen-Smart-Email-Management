// apps/backend/src/core/application/ports/gateways/mail.gateway.ts
// Port: outbound mail transport. Adapter implements SMTP / provider API.

import { Result } from '../../../domain/shared/result';

export interface OutgoingMail {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

export const MAIL_GATEWAY = Symbol('IMailGateway');

export interface IMailGateway {
  send(mail: OutgoingMail): Promise<Result<{ providerMessageId: string }, Error>>;
}
