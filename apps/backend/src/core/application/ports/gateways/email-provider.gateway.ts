/**
 * File:        apps/backend/src/core/application/ports/gateways/email-provider.gateway.ts
 * Module:      Application · Port
 * Purpose:     Email provider gateway port. Abstracts provider-specific
 *              API calls (Gmail/Outlook) into a single interface.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ProviderType } from '../../../domain/bounded-contexts/mailbox/value-objects/provider-type';

export interface EmailMessageSummary {
  id: string;
  externalId: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
}

export interface EmailMessageList {
  messages: EmailMessageSummary[];
  nextCursor: string | null;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface EmailProviderGateway {
  fetchMessage(
    provider: ProviderType,
    accessToken: string,
    messageId: string,
  ): Promise<EmailMessageSummary>;

  fetchMessageList(
    provider: ProviderType,
    accessToken: string,
    cursor?: string,
    limit?: number,
  ): Promise<EmailMessageList>;

  refreshToken(
    provider: ProviderType,
    refreshToken: string,
  ): Promise<RefreshTokenResponse>;

  revokeToken(
    provider: ProviderType,
    accessToken: string,
  ): Promise<void>;
}

export const EMAIL_PROVIDER_GATEWAY = Symbol('EmailProviderGateway');
