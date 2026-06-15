/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-assignments/list-assignments.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     ListAssignments use case. Returns assignments for a workspace
 *              with optional status filter.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailAssignmentRepository,
  EMAIL_ASSIGNMENT_REPOSITORY,
} from '../../../ports/repositories/email-assignment.repository';
import { WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ListAssignmentsInput, ListAssignmentsOutput } from './list-assignments.dto';

export const LIST_ASSIGNMENTS_HANDLER = Symbol('ListAssignmentsHandler');

export class ListAssignmentsHandler {
  constructor(private readonly assignments: IEmailAssignmentRepository) {}

  async execute(input: ListAssignmentsInput): Promise<Result<ListAssignmentsOutput, Error>> {
    const list = await this.assignments.listByWorkspace(WorkspaceId.from(input.workspaceId), input.status);
    return makeResult(Result.ok({
      items: list.map((a) => {
        const props = (a as unknown as { props: { id: string; emailId: string; assignedToUserId: string } }).props;
        return { id: props.id, emailId: props.emailId, status: a.status, assignedToUserId: props.assignedToUserId };
      }),
    }));
  }
}
