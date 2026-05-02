/**
 * File:        apps/backend/src/automation/entities/automation-run.entity.ts
 * Module:      Automation Engine · Entity
 * Purpose:     Tracks one execution of an automation — from QUEUED through a terminal state.
 *              Each run holds the triggering event payload and points to the exact
 *              AutomationVersion that was live when the run started.
 *
 * Exports:
 *   - AutomationRunStatus  — enum: QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELED | SKIPPED_CONDITIONS
 *   - AutomationRun        — TypeORM entity + GraphQL ObjectType
 *
 * Depends on:
 *   - graphql-type-json  — GraphQLJSON scalar for triggerEvent / context jsonb columns
 *
 * Side-effects:
 *   - Registers table `automation_runs`
 *   - Composite indexes: (automationId, createdAt DESC) and (workspaceId, status, createdAt DESC)
 *
 * Key invariants:
 *   - workspaceId is denormalized for efficient per-workspace dashboard queries
 *   - correlationId propagates through all structured logs for one run (grep handle)
 *   - Worker checks status before each step; CANCELED stops execution gracefully
 *
 * Read order:
 *   1. AutomationRunStatus — lifecycle states
 *   2. AutomationRun       — fields
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
} from 'typeorm';

export enum AutomationRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  SKIPPED_CONDITIONS = 'SKIPPED_CONDITIONS',
}

registerEnumType(AutomationRunStatus, { name: 'AutomationRunStatus' });

@ObjectType()
@Entity('automation_runs')
@Index(['automationId', 'createdAt'])
@Index(['workspaceId', 'status', 'createdAt'])
export class AutomationRun {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  automationId: string;

  @Field()
  @Column()
  automationVersionId: string;

  @Field()
  @Index()
  @Column()
  workspaceId: string;

  @Field(() => AutomationRunStatus)
  @Column({ type: 'varchar', default: AutomationRunStatus.QUEUED })
  status: AutomationRunStatus;

  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  triggerEvent: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, unknown> | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  errorCode?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Field()
  @Column()
  correlationId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
