/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/remove-member/remove-member.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for RemoveMember use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RemoveMemberHandler } from './remove-member.handler';
import { RemoveMemberCommand } from './remove-member.command';
import { InMemoryMembershipRepository } from '../../../../testing/in-memory-membership.repository';
import { InMemoryWorkspaceRepository } from '../../../../testing/in-memory-workspace.repository';

describe('RemoveMemberHandler', () => {
  let handler: RemoveMemberHandler;
  let membershipRepo: InMemoryMembershipRepository;
  let workspaceRepo: InMemoryWorkspaceRepository;

  beforeEach(() => {
    membershipRepo = new InMemoryMembershipRepository();
    workspaceRepo = new InMemoryWorkspaceRepository();
    handler = new RemoveMemberHandler(membershipRepo as any, workspaceRepo as any);
  });

  it('should remove a member', async () => {
    await membershipRepo.save({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      email: 'u1@x.com',
      role: 'MEMBER',
      status: 'active',
      invitedByUserId: 'user-2',
      joinedAt: new Date(),
    } as any);

    const result = await handler.execute(new RemoveMemberCommand({
      membershipId: 'm-1',
      actorUserId: 'user-2',
    }));

    expect(result.isOk()).toBe(true);
  });

  it('should fail when trying to remove last owner', async () => {
    await membershipRepo.save({
      id: 'm-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      email: 'u1@x.com',
      role: 'OWNER',
      status: 'active',
      invitedByUserId: 'user-2',
      joinedAt: new Date(),
    } as any);

    const result = await handler.execute(new RemoveMemberCommand({
      membershipId: 'm-1',
      actorUserId: 'user-2',
    }));

    expect(result.isErr()).toBe(true);
  });
});
