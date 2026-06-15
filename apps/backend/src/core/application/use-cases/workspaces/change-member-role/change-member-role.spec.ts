/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/change-member-role/change-member-role.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for ChangeMemberRole use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ChangeMemberRoleHandler } from './change-member-role.handler';
import { ChangeMemberRoleCommand } from './change-member-role.command';
import { InMemoryMembershipRepository } from '../../../../testing/in-memory-membership.repository';
import { Role } from '../../../../domain/bounded-contexts/workspaces/value-objects/role';

describe('ChangeMemberRoleHandler', () => {
  let handler: ChangeMemberRoleHandler;
  let membershipRepo: InMemoryMembershipRepository;

  beforeEach(() => {
    membershipRepo = new InMemoryMembershipRepository();
    handler = new ChangeMemberRoleHandler(membershipRepo as any);
  });

  it('should change role when actor is admin', async () => {
    await membershipRepo.save({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', email: 'u1@x.com', role: 'ADMIN', status: 'active', invitedByUserId: 'user-1' } as any);
    await membershipRepo.save({ id: 'm-2', workspaceId: 'ws-1', userId: 'user-2', email: 'u2@x.com', role: 'MEMBER', status: 'active', invitedByUserId: 'user-1' } as any);

    const result = await handler.execute(new ChangeMemberRoleCommand({
      membershipId: 'm-2',
      newRole: Role.ADMIN,
      actorUserId: 'user-1',
    }));

    expect(result.isOk()).toBe(true);
  });

  it('should fail when member not found', async () => {
    const result = await handler.execute(new ChangeMemberRoleCommand({
      membershipId: 'nonexistent',
      newRole: Role.ADMIN,
      actorUserId: 'user-1',
    }));
    expect(result.isErr()).toBe(true);
  });
});
