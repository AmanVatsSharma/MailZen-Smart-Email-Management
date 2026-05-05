/**
 * File:        apps/backend/src/automation/integrations/webhook-integration.service.ts
 * Module:      Automation Engine · Integrations
 * Purpose:     Manages the WEBHOOK_GENERIC workspace integration lifecycle:
 *              install (generate HMAC key, encrypt, store), revoke, and fetch config.
 *              The plaintext HMAC key is returned exactly once at install time.
 *
 * Exports:
 *   - WebhookIntegrationService  — Injectable service
 *     - installWebhook(workspaceId, url, displayName, installedByUserId) → { integration, plaintextSecret }
 *     - revokeWebhook(workspaceId) → WorkspaceIntegration
 *     - getWebhookIntegration(workspaceId) → WorkspaceIntegration | null
 *     - getDecryptedSecret(workspaceId) → string  — for webhook.post action (server-side only)
 *
 * Depends on:
 *   - WorkspaceIntegration repo      — persistence
 *   - encryptProviderSecret          — AES-256-GCM envelope encryption
 *   - decryptProviderSecret          — for reading back during POST signing
 *   - resolveProviderSecretsKeyring  — loads keyring from env vars
 *
 * Side-effects:
 *   - Writes to workspace_integrations table
 *
 * Key invariants:
 *   - plaintextSecret is returned ONLY at install time and never stored in plaintext
 *   - UNIQUE(workspaceId, provider) — reinstall revokes the old secret and creates a new one
 *   - Config jsonb stores { url, displayName } for the webhook target
 *
 * Read order:
 *   1. installWebhook  — main install flow
 *   2. revokeWebhook   — revocation
 *   3. getDecryptedSecret — used by webhook.post action handler at send time
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
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
import { serializeStructuredLog } from '../../common/logging/structured-log.util';

@Injectable()
export class WebhookIntegrationService {
  private readonly logger = new Logger(WebhookIntegrationService.name);

  constructor(
    @InjectRepository(WorkspaceIntegration)
    private readonly integrationRepo: Repository<WorkspaceIntegration>,
  ) {}

  async installWebhook(
    workspaceId: string,
    url: string,
    displayName: string,
    installedByUserId: string,
  ): Promise<{ integration: WorkspaceIntegration; plaintextSecret: string }> {
    const keyring = resolveProviderSecretsKeyring();
    const plaintextSecret = randomBytes(32).toString('hex');
    const encryptedSecret = encryptProviderSecret(plaintextSecret, keyring);

    // Upsert: delete old and insert new so the UNIQUE constraint doesn't conflict
    await this.integrationRepo.delete({ workspaceId, provider: WorkspaceIntegrationProvider.WEBHOOK_GENERIC });

    const integration = await this.integrationRepo.save(
      this.integrationRepo.create({
        workspaceId,
        provider: WorkspaceIntegrationProvider.WEBHOOK_GENERIC,
        status: WorkspaceIntegrationStatus.ACTIVE,
        displayName,
        encryptedSecret,
        config: { url },
        installedByUserId,
      }),
    );

    this.logger.log(
      serializeStructuredLog({
        event: 'webhook_integration_installed',
        workspaceId,
        integrationId: integration.id,
      }),
    );

    return { integration, plaintextSecret };
  }

  async revokeWebhook(workspaceId: string): Promise<WorkspaceIntegration> {
    const integration = await this.integrationRepo.findOneOrFail({
      where: { workspaceId, provider: WorkspaceIntegrationProvider.WEBHOOK_GENERIC },
    });
    integration.status = WorkspaceIntegrationStatus.REVOKED;
    return this.integrationRepo.save(integration);
  }

  async getWebhookIntegration(workspaceId: string): Promise<WorkspaceIntegration | null> {
    return this.integrationRepo.findOne({
      where: { workspaceId, provider: WorkspaceIntegrationProvider.WEBHOOK_GENERIC },
    });
  }

  async getDecryptedSecret(workspaceId: string): Promise<string | null> {
    const integration = await this.getWebhookIntegration(workspaceId);
    if (!integration || integration.status !== WorkspaceIntegrationStatus.ACTIVE) return null;

    const keyring = resolveProviderSecretsKeyring();
    return decryptProviderSecret(integration.encryptedSecret, keyring);
  }

  async getIntegrationById(id: string, workspaceId: string): Promise<WorkspaceIntegration | null> {
    return this.integrationRepo.findOne({ where: { id, workspaceId } });
  }

  async getDecryptedSecretById(id: string, workspaceId: string): Promise<string | null> {
    const integration = await this.getIntegrationById(id, workspaceId);
    if (!integration || integration.status !== WorkspaceIntegrationStatus.ACTIVE) return null;

    const keyring = resolveProviderSecretsKeyring();
    return decryptProviderSecret(integration.encryptedSecret, keyring);
  }
}
