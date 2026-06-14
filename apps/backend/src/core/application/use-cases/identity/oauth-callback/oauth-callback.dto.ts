/**
 * File:        core/application/use-cases/identity/oauth-callback/oauth-callback.dto.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     OAuth callback use case DTOs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { OAuthProvider } from '../../../../domain/bounded-contexts/identity/value-objects/oauth-profile';

export interface OAuthCallbackInput {
  provider: OAuthProvider;
  code: string;
  ip?: string;
  userAgent?: string;
}

export interface OAuthCallbackOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
  isNewUser: boolean;
}