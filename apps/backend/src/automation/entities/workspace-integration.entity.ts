/**
 * File:        apps/backend/src/automation/entities/workspace-integration.entity.ts
 * Module:      Automation Engine · Entity
 * Purpose:     Stores encrypted credentials for external integrations (Slack, webhook, etc.)
 *              scoped to a workspace. One row per (workspaceId, provider) pair.
 *
 * Exports:
 *   - WorkspaceIntegrationProvider  — enum: SLACK | HUBSPOT | LINEAR | JIRA | WEBHOOK_GENERIC
 *   - WorkspaceIntegrationStatus    — enum: ACTIVE | REVOKED | ERROR
 *   - WorkspaceIntegration          — TypeORM entity + GraphQL ObjectType
 *
 * Depends on:
 *   - graphql-type-json  — GraphQLJSON scalar for config jsonb column
 *
 * Side-effects:
 *   - Registers table `workspace_integrations`
 *   - UNIQUE constraint on (workspaceId, provider) — one active integration per type per workspace
 *
 * Key invariants:
 *   - encryptedSecret stored via encryptProviderSecret (AES-256-GCM key rotation aware)
 *   - The raw secret is NEVER stored in plaintext or logged
 *   - For WEBHOOK_GENERIC: encryptedSecret holds the HMAC signing key; shown once on install
 *   - For SLACK: encryptedSecret holds the bot OAuth token; config holds channel/team metadata
 *
 * Read order:
 *   1. WorkspaceIntegrationProvider / WorkspaceIntegrationStatus — enum values
 *   2. WorkspaceIntegration — entity fields
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum WorkspaceIntegrationProvider {
  SLACK = 'SLACK',
  HUBSPOT = 'HUBSPOT',
  LINEAR = 'LINEAR',
  JIRA = 'JIRA',
  WEBHOOK_GENERIC = 'WEBHOOK_GENERIC',
}

registerEnumType(WorkspaceIntegrationProvider, {
  name: 'WorkspaceIntegrationProvider',
});

export enum WorkspaceIntegrationStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  ERROR = 'ERROR',
}

registerEnumType(WorkspaceIntegrationStatus, {
  name: 'WorkspaceIntegrationStatus',
});

@ObjectType()
@Entity('workspace_integrations')
@Unique(['workspaceId', 'provider'])
export class WorkspaceIntegration {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  workspaceId: string;

  @Field(() => WorkspaceIntegrationProvider)
  @Column({ type: 'varchar' })
  provider: WorkspaceIntegrationProvider;

  @Field(() => WorkspaceIntegrationStatus)
  @Column({ type: 'varchar', default: WorkspaceIntegrationStatus.ACTIVE })
  status: WorkspaceIntegrationStatus;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  displayName?: string | null;

  @Column({ type: 'text' })
  encryptedSecret: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, unknown> | null;

  @Field()
  @Column()
  installedByUserId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
