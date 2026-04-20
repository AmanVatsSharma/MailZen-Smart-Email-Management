/**
 * File:        apps/backend/src/email/email-assignment.resolver.ts
 * Module:      Email · Assignments · GraphQL Resolver
 * Purpose:     Exposes email assignment mutations and queries over the GraphQL API,
 *              delegating all business logic to EmailAssignmentService.
 *
 * Exports:
 *   - EmailAssignmentResolver  — NestJS @Resolver for EmailAssignment
 *     Mutations:
 *       - assignEmail(input) → EmailAssignment
 *       - transferEmail(input) → EmailAssignment
 *       - resolveEmailAssignment(assignmentId) → EmailAssignment
 *     Queries:
 *       - getEmailAssignment(emailId) → EmailAssignment | null
 *       - getWorkspaceAssignments(workspaceId, status?) → EmailAssignment[]
 *
 * Depends on:
 *   - ./email-assignment.service — all business logic
 *   - ../common/guards/jwt-auth.guard — authentication
 *
 * Side-effects:
 *   - DB writes via EmailAssignmentService (email_assignments table)
 *
 * Key invariants:
 *   - All operations require JWT auth
 *   - assignedByUserId is always the calling user (extracted from JWT context)
 *
 * Read order:
 *   1. assignEmail / transferEmail / resolveEmailAssignment — mutation handlers
 *   2. getEmailAssignment / getWorkspaceAssignments         — query handlers
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailAssignment } from './entities/email-assignment.entity';
import { EmailAssignmentService } from './email-assignment.service';
import { AssignEmailInput, TransferEmailInput } from './dto/email-assignment.input';

interface RequestContext {
  req: { user: { id: string } };
}

@Resolver(() => EmailAssignment)
@UseGuards(JwtAuthGuard)
export class EmailAssignmentResolver {
  constructor(private readonly assignmentService: EmailAssignmentService) {}

  @Mutation(() => EmailAssignment)
  async assignEmail(
    @Args('input') input: AssignEmailInput,
    @Context() ctx: RequestContext,
  ): Promise<EmailAssignment> {
    return this.assignmentService.assignEmail(input, ctx.req.user.id);
  }

  @Mutation(() => EmailAssignment)
  async transferEmail(
    @Args('input') input: TransferEmailInput,
    @Context() ctx: RequestContext,
  ): Promise<EmailAssignment> {
    return this.assignmentService.transferEmail(input, ctx.req.user.id);
  }

  @Mutation(() => EmailAssignment)
  async resolveEmailAssignment(
    @Args('assignmentId') assignmentId: string,
  ): Promise<EmailAssignment> {
    return this.assignmentService.resolveAssignment(assignmentId);
  }

  @Query(() => EmailAssignment, { nullable: true })
  async getEmailAssignment(
    @Args('emailId') emailId: string,
  ): Promise<EmailAssignment | null> {
    return this.assignmentService.getAssignmentByEmail(emailId);
  }

  @Query(() => [EmailAssignment])
  async getWorkspaceAssignments(
    @Args('workspaceId') workspaceId: string,
    @Args('status', { type: () => String, nullable: true }) status?: string,
  ): Promise<EmailAssignment[]> {
    return this.assignmentService.getWorkspaceAssignments(workspaceId, status);
  }
}
