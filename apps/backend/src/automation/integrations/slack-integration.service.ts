/**
 * File:        apps/backend/src/automation/integrations/slack-integration.service.ts
 * Module:      Automation Engine · Integrations
 * Purpose:     Manages the Slack OAuth v2 install flow, bot token storage,
 *              channel listing, and default-channel selection.
 *
 * Exports:
 *   - SlackIntegrationService  — Injectable service
 *     - getInstallUrl(workspaceId) → string  — Slack OAuth authorize URL
 *     - handleCallback(code, rawState) → { integration, workspaceId }
 *     - revokeSlack(workspaceId) → WorkspaceIntegration
 *     - getSlackIntegration(workspaceId) → WorkspaceIntegration | null
 *     - listChannels(workspaceId) → SlackChannel[]
 *     - setDefaultChannel(workspaceId, channelId, channelName) → WorkspaceIntegration
 *     - getDecryptedToken(workspaceId) → string  — for notify.slack action
 *
 * Depends on:
 *   - WorkspaceIntegration repo       — persistence
 *   - buildOAuthState / verifyOAuthState — CSRF-safe state token
 *   - encryptProviderSecret / decrypt  — AES-256-GCM bot token storage
 *   - resolveProviderSecretsKeyring   — keyring from env
 *
 * Side-effects:
 *   - Writes to workspace_integrations table
 *   - Calls Slack API (oauth.v2.access, conversations.list)
 *
 * Key invariants:
 *   - workspaceId is embedded in the OAuth state redirect field to survive the browser round-trip
 *   - Bot token is never logged or returned to the client; stored encrypted
 *   - UNIQUE(workspaceId, SLACK) — reinstall deletes the old row first
 *
 * Read order:
 *   1. getInstallUrl  — OAuth initiation
 *   2. handleCallback — token exchange + storage
 *   3. listChannels   — channel picker data
 *   4. setDefaultChannel — channel selection persistence
 *   5. getDecryptedToken — used by notify.slack action
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkspaceIntegration,
  WorkspaceIntegrationProvider,
  WorkspaceIntegrationStatus,
} from '../entities/workspace-integration.entity';
import {
  encryptProviderSecret,
  decryptProviderSecret,
  resolveProviderSecretsKeyring,
} from '../../common/provider-secrets.util';
import { buildOAuthState, verifyOAuthState } from '../../auth/oauth-state.util';
import { serializeStructuredLog } from '../../common/logging/structured-log.util';
import { SlackChannel } from '../dto/slack-channel.type';

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: { id: string; name: string };
  authed_user: { id: string };
}

interface SlackConversationsResponse {
  ok: boolean;
  channels?: Array<{ id: string; name: string; is_private: boolean }>;
}

@Injectable()
export class SlackIntegrationService {
  private readonly logger = new Logger(SlackIntegrationService.name);

  constructor(
    @InjectRepository(WorkspaceIntegration)
    private readonly integrationRepo: Repository<WorkspaceIntegration>,
  ) {}

  getInstallUrl(workspaceId: string): string {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) throw new Error('SLACK_CLIENT_ID not configured');

    const redirectUri = this.redirectUri();
    // workspaceId survives the browser round-trip encoded in the state's redirect field.
    const state = buildOAuthState(`/settings/integrations?workspaceId=${workspaceId}`);

    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'chat:write,channels:read,channels:join,groups:read');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    return url.toString();
  }

  async handleCallback(
    code: string,
    rawState: string,
  ): Promise<{ integration: WorkspaceIntegration; workspaceId: string }> {
    // 10-minute state window — generous enough for slow OAuth logins
    const payload = verifyOAuthState(rawState, 10 * 60 * 1000);
    const stateUrl = new URL(payload.redirect ?? '', 'http://localhost');
    const workspaceId = stateUrl.searchParams.get('workspaceId') ?? '';
    if (!workspaceId) throw new Error('workspaceId missing from OAuth state');

    const clientId = process.env.SLACK_CLIENT_ID ?? '';
    const clientSecret = process.env.SLACK_CLIENT_SECRET ?? '';
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.redirectUri(),
    });

    const resp = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await resp.json()) as SlackOAuthResponse;
    if (!data.ok) throw new Error(`Slack OAuth failed: ${data.error}`);

    const keyring = resolveProviderSecretsKeyring();
    const encryptedSecret = encryptProviderSecret(data.access_token, keyring);

    await this.integrationRepo.delete({
      workspaceId,
      provider: WorkspaceIntegrationProvider.SLACK,
    });

    const integration = await this.integrationRepo.save(
      this.integrationRepo.create({
        workspaceId,
        provider: WorkspaceIntegrationProvider.SLACK,
        status: WorkspaceIntegrationStatus.ACTIVE,
        displayName: `Slack — ${data.team.name}`,
        encryptedSecret,
        config: {
          teamId: data.team.id,
          teamName: data.team.name,
          botUserId: data.bot_user_id,
          appId: data.app_id,
        },
        installedByUserId: data.authed_user?.id ?? 'slack-oauth',
      }),
    );

    this.logger.log(
      serializeStructuredLog({
        event: 'slack_integration_installed',
        workspaceId,
        integrationId: integration.id,
        teamId: data.team.id,
      }),
    );

    return { integration, workspaceId };
  }

  async revokeSlack(workspaceId: string): Promise<WorkspaceIntegration> {
    const integration = await this.integrationRepo.findOneOrFail({
      where: { workspaceId, provider: WorkspaceIntegrationProvider.SLACK },
    });
    integration.status = WorkspaceIntegrationStatus.REVOKED;
    return this.integrationRepo.save(integration);
  }

  async getSlackIntegration(workspaceId: string): Promise<WorkspaceIntegration | null> {
    return this.integrationRepo.findOne({
      where: { workspaceId, provider: WorkspaceIntegrationProvider.SLACK },
    });
  }

  async listChannels(workspaceId: string): Promise<SlackChannel[]> {
    const token = await this.getDecryptedToken(workspaceId);

    const resp = await fetch(
      'https://slack.com/api/conversations.list?limit=200&exclude_archived=true&types=public_channel,private_channel',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await resp.json()) as SlackConversationsResponse;
    if (!data.ok || !data.channels) return [];

    return data.channels.map((c) => ({
      id: c.id,
      name: c.name,
      isPrivate: c.is_private,
    }));
  }

  async setDefaultChannel(
    workspaceId: string,
    channelId: string,
    channelName: string,
  ): Promise<WorkspaceIntegration> {
    const integration = await this.integrationRepo.findOneOrFail({
      where: { workspaceId, provider: WorkspaceIntegrationProvider.SLACK },
    });
    integration.config = {
      ...(integration.config ?? {}),
      defaultChannel: { id: channelId, name: channelName },
    };
    return this.integrationRepo.save(integration);
  }

  async getDecryptedToken(workspaceId: string): Promise<string> {
    const integration = await this.integrationRepo.findOne({
      where: {
        workspaceId,
        provider: WorkspaceIntegrationProvider.SLACK,
        status: WorkspaceIntegrationStatus.ACTIVE,
      },
    });
    if (!integration) throw new NotFoundException('Slack integration not connected');

    const keyring = resolveProviderSecretsKeyring();
    return decryptProviderSecret(integration.encryptedSecret, keyring);
  }

  private redirectUri(): string {
    return (
      process.env.SLACK_REDIRECT_URI ??
      'http://localhost:4000/integrations/slack/callback'
    );
  }
}
