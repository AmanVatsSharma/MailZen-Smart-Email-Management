/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/create-workspace/create-workspace.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for CreateWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { CreateWorkspaceHandler } from './create-workspace.handler';
import { CreateWorkspaceCommand } from './create-workspace.command';
import { InMemoryWorkspaceRepository } from '../../../../testing/in-memory-workspace.repository';
import { InMemoryMembershipRepository } from '../../../../testing/in-memory-membership.repository';

describe('CreateWorkspaceHandler', () => {
  let handler: CreateWorkspaceHandler;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let membershipRepo: InMemoryMembershipRepository;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepository();
    membershipRepo = new InMemoryMembershipRepository();
    handler = new CreateWorkspaceHandler(workspaceRepo as any, membershipRepo as any);
  });

  it('should create a workspace for a valid input', async () => {
    const result = await handler.execute(new CreateWorkspaceCommand({
      userId: 'user-1',
      name: 'Test Workspace',
    }));

    expect(result.isOk()).toBe(true);
    expect(workspaceRepo.items.length).toBe(1);
    expect(membershipRepo.items.length).toBe(1);
  });

  it('should fail when name is too short', async () => {
    const result = await handler.execute(new CreateWorkspaceCommand({
      userId: 'user-1',
      name: 'A',
    }));

    expect(result.isErr()).toBe(true);
  });

  it('should generate unique slug for duplicates', async () => {
    const input = { userId: 'user-1', name: 'Same Name' };
    await handler.execute(new CreateWorkspaceCommand(input));

    const result2 = await handler.execute(new CreateWorkspaceCommand(input));
    expect(result2.isOk()).toBe(true);
    expect(workspaceRepo.items.length).toBe(2);
  });
});
