/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/rename-workspace/rename-workspace.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for RenameWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RenameWorkspaceHandler } from './rename-workspace.handler';
import { RenameWorkspaceCommand } from './rename-workspace.command';
import { InMemoryWorkspaceRepository } from '../../../../testing/in-memory-workspace.repository';
import { InMemoryMembershipRepository } from '../../../../testing/in-memory-membership.repository';

describe('RenameWorkspaceHandler', () => {
  let handler: RenameWorkspaceHandler;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let membershipRepo: InMemoryMembershipRepository;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepository();
    membershipRepo = new InMemoryMembershipRepository();
    handler = new RenameWorkspaceHandler(workspaceRepo as any, membershipRepo as any);
  });

  it('should rename workspace when user is owner', async () => {
    await workspaceRepo.save({
      id: 'ws-1',
      ownerUserId: 'user-1',
      name: 'Old Name',
      slug: 'old',
      isPersonal: false,
    } as any);

    const result = await handler.execute(new RenameWorkspaceCommand({
      workspaceId: 'ws-1',
      newName: 'New Name',
      actorUserId: 'user-1',
    }));

    expect(result.isOk()).toBe(true);
    expect(workspaceRepo.items[0].name).toBe('New Name');
  });

  it('should fail when workspace not found', async () => {
    const result = await handler.execute(new RenameWorkspaceCommand({
      workspaceId: 'nonexistent',
      newName: 'New Name',
      actorUserId: 'user-1',
    }));

    expect(result.isErr()).toBe(true);
  });

  it('should fail when user is not owner', async () => {
    await workspaceRepo.save({
      id: 'ws-1',
      ownerUserId: 'user-1',
      name: 'Old Name',
      slug: 'old',
      isPersonal: false,
    } as any);

    const result = await handler.execute(new RenameWorkspaceCommand({
      workspaceId: 'ws-1',
      newName: 'New Name',
      actorUserId: 'user-2',
    }));

    expect(result.isErr()).toBe(true);
  });
});
