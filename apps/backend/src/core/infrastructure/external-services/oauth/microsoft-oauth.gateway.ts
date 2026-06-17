// apps/backend/src/core/infrastructure/external-services/oauth/microsoft-oauth.gateway.ts
// Adapter: implements IOAuthGateway for Microsoft.

import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import { IOAuthGateway, OAuthProfile } from '../../../application/ports/gateways/oauth.gateway';

@Injectable()
export class MicrosoftOAuthGateway implements IOAuthGateway {
  private readonly logger = new Logger(MicrosoftOAuthGateway.name);

  async exchangeCodeForProfile(
    provider: 'google' | 'microsoft',
    code: string,
    context: { loginRedirect: string; clientId: string; clientSecret: string },
  ): Promise<OAuthProfile> {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: context.clientId,
          client_secret: context.clientSecret,
          code,
          redirect_uri: context.loginRedirect,
          grant_type: 'authorization_code',
        }),
      },
    );
    const tokens = await tokenRes.json() as { access_token: string };
    const client = Client.init({ authProvider: (done) => done(null, tokens.access_token) });
    const me = await client.api('/me').get();
    return {
      provider: 'Microsoft',
      providerUserId: me.id,
      email: me.mail ?? me.userPrincipalName,
      displayName: me.displayName ?? '',
    };
  }
}
