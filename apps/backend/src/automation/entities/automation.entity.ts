/**
 * File:        apps/backend/src/automation/entities/automation.entity.ts
 * Module:      Automation Engine · Entity
 * Purpose:     Represents a workspace-scoped automation rule (the "container"); the live
 *              trigger/conditions/steps live in the linked AutomationVersion.
 *
 * Exports:
 *   - AutomationStatus   — enum: DRAFT | ENABLED | DISABLED | ARCHIVED
 *   - Automation         — TypeORM entity + GraphQL ObjectType
 *
 * Depends on:
 *   - @nestjs/graphql — field/type decorators
 *   - typeorm         — column/entity decorators
 *
 * Side-effects:
 *   - Registers table `automations`
 *   - Registers `AutomationStatus` enum with GraphQL via registerEnumType
 *
 * Key invariants:
 *   - currentVersionId is NULL until the first version is published (DRAFT state)
 *   - ownerUserId NULL means workspace-wide scope; non-NULL means personal automation
 *   - Status transitions: DRAFT → ENABLED | DISABLED → ARCHIVED (no resurrection)
 *
 * Read order:
 *   1. AutomationStatus — understand the lifecycle states
 *   2. Automation       — the entity fields
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AutomationStatus {
  DRAFT = 'DRAFT',
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  ARCHIVED = 'ARCHIVED',
}

registerEnumType(AutomationStatus, { name: 'AutomationStatus' });

@ObjectType()
@Entity('automations')
export class Automation {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  workspaceId: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  ownerUserId?: string | null;

  @Field()
  @Column()
  name: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Field(() => AutomationStatus)
  @Column({ type: 'varchar', default: AutomationStatus.DRAFT })
  status: AutomationStatus;

  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  currentVersionId?: string | null;

  @Field()
  @Column()
  createdByUserId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
