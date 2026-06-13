/**
 * File:        apps/backend/src/core/application/ports/repositories/email-assignment.repository.ts
 * Module:      Core · Application · Ports
 * Purpose:     IEmailAssignmentRepository port.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailAssignment } from '../../../domain/bounded-contexts/messaging/email-assignment.aggregate';
import { EmailId, UserId, WorkspaceId } from '../../../domain/shared/value-objects/ids';
import { EmailAssignmentStatus } from '../../../domain/bounded-contexts/messaging/email-assignment.aggregate';

export const EMAIL_ASSIGNMENT_REPOSITORY = Symbol('IEmailAssignmentRepository');

export interface IEmailAssignmentRepository {
  save(assignment: EmailAssignment): Promise<void>;
  findById(id: string): Promise<EmailAssignment | null>;
  findOpenForEmail(emailId: EmailId): Promise<EmailAssignment | null>;
  listByWorkspace(workspaceId: WorkspaceId, status?: EmailAssignmentStatus): Promise<EmailAssignment[]>;
  listByAssignee(userId: UserId): Promise<EmailAssignment[]>;
}
