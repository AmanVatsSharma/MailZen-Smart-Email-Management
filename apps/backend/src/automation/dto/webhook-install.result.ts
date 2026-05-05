/**
 * File:        apps/backend/src/automation/dto/webhook-install.result.ts
 * Module:      Automation Engine · DTO
 * Purpose:     GraphQL ObjectType returned by installWebhookIntegration mutation.
 *              Contains the integration row AND the plaintext HMAC secret (shown once).
 *
 * Exports:
 *   - WebhookInstallResult  — ObjectType with integration + plaintextSecret
 *
 * Key invariants:
 *   - plaintextSecret is returned only at install time; never stored in plaintext
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Field, ObjectType } from '@nestjs/graphql';
import { WorkspaceIntegration } from '../entities/workspace-integration.entity';

@ObjectType()
export class WebhookInstallResult {
  @Field(() => WorkspaceIntegration)
  integration: WorkspaceIntegration;

  @Field()
  plaintextSecret: string;
}
