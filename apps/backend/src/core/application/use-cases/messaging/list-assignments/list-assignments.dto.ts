/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-assignments/list-assignments.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the ListAssignments use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailAssignmentStatus } from '../../../../domain/bounded-contexts/messaging/email-assignment.aggregate';

export interface ListAssignmentsInput {
  workspaceId: string;
  status?: EmailAssignmentStatus;
}

export interface ListAssignmentsOutput {
  items: Array<{ id: string; emailId: string; status: EmailAssignmentStatus; assignedToUserId: string }>;
}
