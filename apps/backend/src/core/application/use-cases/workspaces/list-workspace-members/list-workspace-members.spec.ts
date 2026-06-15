/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/list-workspace-members/list-workspace-members.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for ListWorkspaceMembers use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListWorkspaceMembersHandler } from './list-workspace-members.handler';
import { ListWorkspaceMembersCommand } from './list-workspace-members.command';
import { InMemoryWorkspaceRepository } from '../../../../testing/in-memory-workspace.repository';
import { InMemoryMembershipRepository } from '../../../../testing/in-memory-membership.repository';

describe('ListWorkspaceMembersHandler', () => {
  let handler: ListWorkspaceMembersHandler;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let membershipRepo: InMemoryMembershipRepository;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepository();
    membershipRepo = new InMemoryMembershipRepository();
    handler = new ListWorkspaceMembersHandler(workspaceRepo as any, membershipRepo as any);
  });

  it('should list members for a workspace', async () => {
    await workspaceRepo.save({ id: 'ws-1', ownerUserId: 'user-1', name: 'WS', slug: 'ws', isPersonal: false } as any);
    await membershipRepo.save({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', email: 'u1@x.com', role: 'OWNER', status: 'active', invitedByUserId: 'user-1', joinedAt: new Date() } as any);

    const result = await handler.execute(new ListWorkspaceMembersCommand({
      workspaceId: 'ws-1',
      actorUserId: 'user-1',
    }));

    expect(result.isOk()).toBe(true);
    expect(result.value?.length).toBe(1);
  });

  it('should fail when workspace not found', async () => {
    const result = await handler.execute(new ListWorkspaceMembersCommand({
      workspaceId: 'nonexistent',
      actorUserId: 'user-1',
    }));
    expect(result.isErr()).toBe(true);
  });
});
