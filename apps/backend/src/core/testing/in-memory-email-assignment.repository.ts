/**
 * File:        apps/backend/src/core/testing/in-memory-email-assignment.repository.ts
 * Module:      Core · Testing
 * Purpose:     In-memory IEmailAssignmentRepository fake.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { IEmailAssignmentRepository } from 'application/ports/repositories/email-assignment.repository';
import { EmailAssignment, EmailAssignmentStatus } from '../domain/bounded-contexts/messaging/email-assignment.aggregate';
import { EmailId, UserId, WorkspaceId } from '../domain/shared/value-objects/ids';

export class InMemoryEmailAssignmentRepository implements IEmailAssignmentRepository {
  private readonly store = new Map<string, EmailAssignment>();

  async save(assignment: EmailAssignment): Promise<void> {
    this.store.set(assignment.id, assignment);
  }

  async findById(id: string): Promise<EmailAssignment | null> {
    return this.store.get(id) ?? null;
  }

  async findOpenForEmail(emailId: EmailId): Promise<EmailAssignment | null> {
    for (const a of this.store.values()) {
      if (a.emailId === emailId && (a.status === 'open' || a.status === 'in_progress')) {
        return a;
      }
    }
    return null;
  }

  async listByWorkspace(
    _workspaceId: WorkspaceId,
    status?: EmailAssignmentStatus,
  ): Promise<EmailAssignment[]> {
    return [...this.store.values()].filter((a) => !status || a.status === status);
  }

  async listByAssignee(userId: UserId): Promise<EmailAssignment[]> {
    return [...this.store.values()].filter((a) => a.assignedToUserId === userId);
  }
}
