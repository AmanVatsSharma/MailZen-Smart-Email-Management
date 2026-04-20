/**
 * File:        apps/backend/src/email/dto/email-assignment.input.ts
 * Module:      Email · Assignments · DTOs
 * Purpose:     GraphQL InputTypes for email thread assignment mutations:
 *              assign, transfer, and resolve operations used by the team inbox.
 *
 * Exports:
 *   - AssignEmailInput   — input for assigning a thread to a workspace member
 *   - TransferEmailInput — input for re-assigning (handing off) an existing assignment
 *
 * Depends on:
 *   - none (GraphQL/class-validator decorators only)
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - workspaceId must match the workspace the caller belongs to (enforced in service)
 *   - dueAt is stored as-is; no SLA enforcement is applied automatically
 *
 * Read order:
 *   1. AssignEmailInput   — primary assign mutation input
 *   2. TransferEmailInput — re-assign / handoff mutation input
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class AssignEmailInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  emailId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  assigneeUserId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  workspaceId: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  dueAt?: string;
}

@InputType()
export class TransferEmailInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  assignmentId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  toUserId: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
