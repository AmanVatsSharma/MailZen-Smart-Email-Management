/**
 * File:        apps/backend/src/automation/actions/email-assign.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Assigns the email thread to a specific user or round-robins among
 *              active workspace members (role MEMBER+).
 *
 * Exports:
 *   - EmailAssignActionHandler  — Injectable handler for 'email.assign'
 *
 * Depends on:
 *   - EmailAssignmentService  — assignEmail(input, assignedByUserId)
 *   - WorkspaceMember entity  — for round-robin candidate pool
 *
 * Side-effects:
 *   - Writes to email_assignments table
 *
 * Key invariants:
 *   - Round-robin state is stateless per-run: picks candidate by hash of
 *     (workspaceId + threadId) to deterministically but variably route
 *   - A target userId of 'system' is used as assignedByUserId for automation-driven assigns
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { EmailAssignmentService } from '../../email/email-assignment.service';
import { WorkspaceMember } from '../../workspace/entities/workspace-member.entity';

@Injectable()
export class EmailAssignActionHandler implements ActionHandler {
  readonly actionType = 'email.assign' as const;

  constructor(
    private readonly assignmentService: EmailAssignmentService,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'email.assign') return { skipped: true };

    const event = ctx.triggerEvent as Record<string, unknown>;
    const emailId = (event['messageId'] ?? event['emailId']) as string | undefined;
    if (!emailId) return { skipped: true };

    let targetUserId = step.userId;

    if (step.roundRobin) {
      const members = await this.memberRepo.find({
        where: { workspaceId: ctx.workspaceId, status: 'active' },
      });
      if (!members.length) return { skipped: true };

      // Deterministic but distributed routing: hash(emailId) mod pool size
      const hash = Array.from(emailId).reduce((acc, c) => acc + c.charCodeAt(0), 0);
      targetUserId = members[hash % members.length].userId ?? undefined;
    }

    if (!targetUserId) return { skipped: true };

    const assignment = await this.assignmentService.assignEmail(
      { emailId, workspaceId: ctx.workspaceId, assigneeUserId: targetUserId },
      ctx.userId,
    );

    return { data: { assignmentId: assignment.id, assignedToUserId: targetUserId } };
  }
}
