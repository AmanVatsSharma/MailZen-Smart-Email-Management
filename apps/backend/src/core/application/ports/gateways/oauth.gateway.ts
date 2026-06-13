/**
 * File:        core/application/ports/gateways/oauth.gateway.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     OAuth gateway port for exchanging auth codes with providers
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../../../domain/shared/result';
import { OAuthProfile, OAuthProvider } from '../../../domain/bounded-contexts/identity/value-objects/oauth-profile';

export const OAUTH_GATEWAY = Symbol('IOAuthGateway');

export interface IOAuthGateway {
  exchangeCodeForProfile(
    provider: OAuthProvider,
    code: string
  ): Promise<Result<OAuthProfile, Error>>;
}