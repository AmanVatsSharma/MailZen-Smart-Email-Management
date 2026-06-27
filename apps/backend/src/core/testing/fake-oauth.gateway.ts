/**
 * File:        core/testing/fake-oauth.gateway.ts
 * Module:      Testing
 * Purpose:     In-memory implementation of IOAuthGateway for use case specs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IOAuthGateway } from '../application/ports/gateways/oauth.gateway';
import { OAuthProfile, OAuthProvider } from '../domain/bounded-contexts/identity/value-objects/oauth-profile';
import { Result } from '../domain/shared/result';

export class FakeOAuthGateway implements IOAuthGateway {
  private profiles: Map<string, OAuthProfile> = new Map();

  presetProfile(code: string, profile: OAuthProfile): void {
    this.profiles.set(code, profile);
  }

  async exchangeCodeForProfile(
    provider: OAuthProvider,
    code: string
  ): Promise<Result<OAuthProfile, Error>> {
    const profile = this.profiles.get(code);
    if (!profile) {
      return Result.err(new Error('Invalid OAuth code'));
    }
    if (profile.provider !== provider) {
      return Result.err(new Error('Provider mismatch'));
    }
    return Result.ok(profile);
  }
}