/**
 * File:        apps/backend/src/email/entities/email-assignment.entity.ts
 * Module:      Email · Assignments
 * Purpose:     Persists email thread assignment records, tracking which workspace
 *              member is responsible for a given email thread and its resolution status.
 *
 * Exports:
 *   - EmailAssignmentStatus  — union type of valid status values
 *   - EmailAssignment        — TypeORM + GraphQL ObjectType entity modelling the
 *                              email_assignments table
 *
 * Depends on:
 *   - none (entity-only file; imports are TypeORM and NestJS GraphQL decorators)
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - workspaceId and emailId are indexed for fast per-workspace and per-thread lookups
 *   - assignedToUserId and assignedByUserId are FK references to the users table
 *     (maintained conceptually — no hard FK constraint enforced at TypeORM level here)
 *   - emailId refers to the thread root email ID (FK to email table conceptually)
 *   - status defaults to 'open' on insert
 *
 * Read order:
 *   1. EmailAssignmentStatus  — union type for the status field values
 *   2. EmailAssignment        — full entity definition
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-19
 */

import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type EmailAssignmentStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'transferred';

export enum EmailAssignmentStatusEnum {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  TRANSFERRED = 'transferred',
}

registerEnumType(EmailAssignmentStatusEnum, {
  name: 'EmailAssignmentStatus',
  description: 'Status of an email thread assignment',
});

@ObjectType()
@Entity('email_assignments')
export class EmailAssignment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'uuid' })
  @Index()
  workspaceId: string;

  @Field()
  @Column()
  @Index()
  emailId: string;

  @Field()
  @Column()
  assignedToUserId: string;

  @Field()
  @Column()
  assignedByUserId: string;

  @Field(() => EmailAssignmentStatusEnum)
  @Column({
    type: 'enum',
    enum: ['open', 'in_progress', 'resolved', 'transferred'],
    default: 'open',
  })
  status: EmailAssignmentStatus;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true, type: 'timestamptz' })
  dueAt: Date | null;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true, type: 'timestamptz' })
  resolvedAt: Date | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
