// apps/backend/src/core/infrastructure/external-services/oauth/google-oauth.gateway.ts
// Adapter: implements IOAuthGateway for Google.

import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { IOAuthGateway, OAuthProfile } from '../../../application/ports/gateways/oauth.gateway';

@Injectable()
export class GoogleOAuthGateway implements IOAuthGateway {
  private readonly logger = new Logger(GoogleOAuthGateway.name);

  async exchangeCodeForProfile(
    provider: 'google' | 'microsoft',
    code: string,
    context: { loginRedirect: string; clientId: string; clientSecret: string },
  ): Promise<OAuthProfile> {
    const oauth2 = new google.auth.OAuth2(context.clientId, context.clientSecret, context.loginRedirect);
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);
    const userinfo = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
    return {
      provider: 'Google',
      providerUserId: userinfo.data.id ?? '',
      email: userinfo.data.email ?? '',
      displayName: userinfo.data.name ?? '',
      avatarUrl: userinfo.data.picture ?? undefined,
    };
  }
}
