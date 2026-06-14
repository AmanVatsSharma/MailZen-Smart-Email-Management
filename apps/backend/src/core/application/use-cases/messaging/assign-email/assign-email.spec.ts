/**
 * File:        apps/backend/src/core/application/use-cases/messaging/assign-email/assign-email.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for AssignEmailHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { AssignEmailHandler } from './assign-email.handler';
import { InMemoryEmailAssignmentRepository } from '../../../../../testing/in-memory-email-assignment.repository';

describe('AssignEmailHandler', () => {
  it('creates an open assignment', async () => {
    const assignments = new InMemoryEmailAssignmentRepository();
    const handler = new AssignEmailHandler(assignments);

    const result = await handler.execute({
      emailId: '33333333-3333-4333-8333-333333333333',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      assigneeUserId: '44444444-4444-4444-8444-444444444444',
      assignerUserId: '55555555-5555-4555-8555-555555555555',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('open');
  });

  it('rejects an assignment with no assignee', async () => {
    const handler = new AssignEmailHandler(new InMemoryEmailAssignmentRepository());
    const result = await handler.execute({
      emailId: '33333333-3333-4333-8333-333333333333',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      assigneeUserId: '',
      assignerUserId: '55555555-5555-4555-8555-555555555555',
    });
    expect(result.ok).toBe(false);
  });
});
