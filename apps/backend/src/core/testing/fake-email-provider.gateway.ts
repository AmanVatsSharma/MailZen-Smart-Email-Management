/**
 * File:        apps/backend/src/core/testing/fake-email-provider.gateway.ts
 * Module:      Testing · Fake
 * Purpose:     Fake EmailProviderGateway for unit tests. Returns
 *              pre-configured responses; no real API calls.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { EmailProviderGateway, EmailMessageSummary, EmailMessageList, RefreshTokenResponse } from 'application/ports/gateways/email-provider.gateway';
import { ProviderType } from '../domain/bounded-contexts/mailbox/value-objects/provider-type';

export class FakeEmailProviderGateway implements EmailProviderGateway {
  private nextResponse: EmailMessageList | null = null;
  private nextRefreshResponse: RefreshTokenResponse | null = null;

  fetchMessageCallCount = 0;
  fetchMessageListCallCount = 0;
  refreshCallCount = 0;
  revokeCallCount = 0;

  setNextResponse(response: EmailMessageList): void {
    this.nextResponse = response;
  }

  setNextRefreshResponse(response: RefreshTokenResponse): void {
    this.nextRefreshResponse = response;
  }

  async fetchMessage(
    provider: ProviderType,
    accessToken: string,
    messageId: string,
  ): Promise<EmailMessageSummary> {
    this.fetchMessageCallCount++;
    return {
      id: messageId,
      externalId: messageId,
      subject: 'fake-subject',
      from: 'fake@from.com',
      date: new Date(),
      body: 'fake-body',
    };
  }

  async fetchMessageList(
    provider: ProviderType,
    accessToken: string,
    cursor?: string,
    limit?: number,
  ): Promise<EmailMessageList> {
    this.fetchMessageListCallCount++;
    return this.nextResponse ?? { messages: [], nextCursor: null };
  }

  async refreshToken(
    provider: ProviderType,
    refreshToken: string,
  ): Promise<RefreshTokenResponse> {
    this.refreshCallCount++;
    return this.nextRefreshResponse ?? {
      accessToken: 'fake-access',
      refreshToken: 'fake-refresh',
      expiresAt: new Date(Date.now() + 3600_000),
    };
  }

  async revokeToken(
    provider: ProviderType,
    accessToken: string,
  ): Promise<void> {
    this.revokeCallCount++;
  }

  reset(): void {
    this.nextResponse = null;
    this.nextRefreshResponse = null;
    this.fetchMessageCallCount = 0;
    this.fetchMessageListCallCount = 0;
    this.refreshCallCount = 0;
    this.revokeCallCount = 0;
  }
}
