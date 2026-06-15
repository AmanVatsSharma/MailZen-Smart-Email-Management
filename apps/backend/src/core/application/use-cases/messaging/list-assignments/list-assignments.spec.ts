/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-assignments/list-assignments.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for ListAssignmentsHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { ListAssignmentsHandler } from './list-assignments.handler';
import { InMemoryEmailAssignmentRepository } from '../../../../testing/in-memory-email-assignment.repository';
import { EmailAssignment } from '../../../../domain/bounded-contexts/messaging/email-assignment.aggregate';
import { EmailId, UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';

describe('ListAssignmentsHandler', () => {
  it('returns workspace assignments', async () => {
    const assignments = new InMemoryEmailAssignmentRepository();
    const a = EmailAssignment.assign({
      id: 'a1',
      emailId: EmailId.from('33333333-3333-4333-8333-333333333333'),
      workspaceId: WorkspaceId.from('11111111-1111-4111-8111-111111111111'),
      assigneeUserId: UserId.from('44444444-4444-4444-8444-444444444444'),
      assignerUserId: UserId.from('55555555-5555-4555-8555-555555555555'),
    });
    if (!a.ok) throw new Error('seed');
    await assignments.save(a.value);
    const handler = new ListAssignmentsHandler(assignments);

    const result = await handler.execute({ workspaceId: '11111111-1111-4111-8111-111111111111' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
  });

  it('returns an empty list when no assignments exist', async () => {
    const handler = new ListAssignmentsHandler(new InMemoryEmailAssignmentRepository());
    const result = await handler.execute({ workspaceId: '11111111-1111-4111-8111-111111111111' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(0);
  });
});
