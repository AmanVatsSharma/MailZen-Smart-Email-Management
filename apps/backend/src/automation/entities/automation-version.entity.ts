/**
 * File:        apps/backend/src/automation/entities/automation-version.entity.ts
 * Module:      Automation Engine · Entity
 * Purpose:     Immutable snapshot of an automation's trigger, conditions, and steps.
 *              Every edit to trigger/conditions/steps creates a new row — existing rows
 *              are NEVER mutated after publishedAt is set.
 *
 * Exports:
 *   - AutomationVersion  — TypeORM entity + GraphQL ObjectType
 *
 * Depends on:
 *   - graphql-type-json  — GraphQLJSON scalar for jsonb columns
 *
 * Side-effects:
 *   - Registers table `automation_versions`
 *   - UNIQUE constraint on (automationId, version) enforced at DB level
 *
 * Key invariants:
 *   - Rows are append-only; never UPDATE after insert
 *   - version is monotonically increasing per automationId (service layer enforces)
 *   - AutomationRun stores automationVersionId so running jobs keep executing
 *     the version that started them, even if newer versions exist
 *
 * Read order:
 *   1. AutomationVersion — fields; note jsonb columns for trigger/conditions/steps
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@ObjectType()
@Entity('automation_versions')
@Unique(['automationId', 'version'])
export class AutomationVersion {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  automationId: string;

  @Field(() => Int)
  @Column({ type: 'int' })
  version: number;

  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  trigger: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  conditions?: Record<string, unknown> | null;

  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  steps: Record<string, unknown>[];

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Field()
  @Column()
  publishedByUserId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
