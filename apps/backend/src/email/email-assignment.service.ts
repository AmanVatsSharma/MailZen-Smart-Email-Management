/**
 * File:        apps/backend/src/email/email-assignment.service.ts
 * Module:      Email · Assignments
 * Purpose:     Business logic for email thread assignment lifecycle: assign, transfer,
 *              resolve, and query operations used by the team inbox feature.
 *
 * Exports:
 *   - EmailAssignmentService  — injectable NestJS service
 *     - assignEmail(input, assignedByUserId) → EmailAssignment
 *     - transferEmail(input, assignedByUserId) → EmailAssignment
 *     - resolveAssignment(assignmentId) → EmailAssignment
 *     - getAssignmentByEmail(emailId) → EmailAssignment | null
 *     - getWorkspaceAssignments(workspaceId, status?) → EmailAssignment[]
 *
 * Depends on:
 *   - EmailAssignment entity repository — all persistence operations
 *
 * Side-effects:
 *   - DB writes: INSERT/UPDATE on email_assignments table
 *
 * Key invariants:
 *   - transferEmail creates a new EmailAssignment row (preserving history) rather than
 *     mutating the existing row; the old assignment is set to 'transferred'
 *   - resolveAssignment sets status = 'resolved' and resolvedAt = now()
 *   - getAssignmentByEmail returns the most recent open/in_progress assignment for a thread
 *
 * Read order:
 *   1. assignEmail          — primary assignment creation
 *   2. transferEmail        — handoff to another member
 *   3. resolveAssignment    — mark thread done
 *   4. getAssignmentByEmail — per-thread lookup
 *   5. getWorkspaceAssignments — bulk workspace query
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAssignment } from './entities/email-assignment.entity';
import { AssignEmailInput, TransferEmailInput } from './dto/email-assignment.input';

@Injectable()
export class EmailAssignmentService {
  constructor(
    @InjectRepository(EmailAssignment)
    private readonly repo: Repository<EmailAssignment>,
  ) {}

  async assignEmail(input: AssignEmailInput, assignedByUserId: string): Promise<EmailAssignment> {
    const assignment = this.repo.create({
      emailId: input.emailId,
      workspaceId: input.workspaceId,
      assignedToUserId: input.assigneeUserId,
      assignedByUserId,
      notes: input.notes ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      status: 'open',
    });
    return this.repo.save(assignment);
  }

  async transferEmail(input: TransferEmailInput, assignedByUserId: string): Promise<EmailAssignment> {
    const existing = await this.repo.findOne({ where: { id: input.assignmentId } });
    if (!existing) throw new NotFoundException(`Assignment ${input.assignmentId} not found`);

    // Mark the old assignment as transferred
    existing.status = 'transferred';
    await this.repo.save(existing);

    // Create new assignment for the new assignee
    const transferred = this.repo.create({
      emailId: existing.emailId,
      workspaceId: existing.workspaceId,
      assignedToUserId: input.toUserId,
      assignedByUserId,
      notes: input.notes ?? null,
      dueAt: existing.dueAt,
      status: 'open',
    });
    return this.repo.save(transferred);
  }

  async resolveAssignment(assignmentId: string): Promise<EmailAssignment> {
    const assignment = await this.repo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException(`Assignment ${assignmentId} not found`);

    assignment.status = 'resolved';
    assignment.resolvedAt = new Date();
    return this.repo.save(assignment);
  }

  async getAssignmentByEmail(emailId: string): Promise<EmailAssignment | null> {
    return this.repo.findOne({
      where: [
        { emailId, status: 'open' },
        { emailId, status: 'in_progress' },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async getWorkspaceAssignments(workspaceId: string, status?: string): Promise<EmailAssignment[]> {
    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }
}
