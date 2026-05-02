/**
 * File:        apps/backend/src/automation/entities/automation-step-run.entity.ts
 * Module:      Automation Engine · Entity
 * Purpose:     Records one attempt of one step within an AutomationRun.
 *              Multiple rows per (runId, stepIndex) when retried — each attempt
 *              gets its own row so the full retry history is auditable.
 *
 * Exports:
 *   - AutomationStepRunStatus  — enum: PENDING | RUNNING | SUCCEEDED | FAILED | SKIPPED | RETRYING
 *   - AutomationStepRun        — TypeORM entity + GraphQL ObjectType
 *
 * Depends on:
 *   - graphql-type-json  — GraphQLJSON scalar for input/output jsonb columns
 *
 * Side-effects:
 *   - Registers table `automation_step_runs`
 *   - UNIQUE constraint on (runId, stepIndex, attempt) enforced at DB level
 *
 * Key invariants:
 *   - stepIndex is 0-based; matches the index in AutomationVersion.steps array
 *   - attempt starts at 1; each retry increments it (max 3 per plan spec)
 *   - output JSON should include { creditsConsumed: N } for ai.* step types
 *
 * Read order:
 *   1. AutomationStepRunStatus — lifecycle states
 *   2. AutomationStepRun       — fields
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum AutomationStepRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  RETRYING = 'RETRYING',
}

registerEnumType(AutomationStepRunStatus, { name: 'AutomationStepRunStatus' });

@ObjectType()
@Entity('automation_step_runs')
@Unique(['runId', 'stepIndex', 'attempt'])
export class AutomationStepRun {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  runId: string;

  @Field(() => Int)
  @Column({ type: 'int' })
  stepIndex: number;

  @Field()
  @Column()
  stepType: string;

  @Field(() => AutomationStepRunStatus)
  @Column({ type: 'varchar', default: AutomationStepRunStatus.PENDING })
  status: AutomationStepRunStatus;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  input?: Record<string, unknown> | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  output?: Record<string, unknown> | null;

  @Field(() => Int)
  @Column({ type: 'int', default: 1 })
  attempt: number;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  errorCode?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;
}
