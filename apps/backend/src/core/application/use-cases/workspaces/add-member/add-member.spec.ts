/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/add-member/add-member.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for AddMember use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AddMemberHandler } from './add-member.handler';
import { AddMemberCommand } from './add-member.command';
import { InMemoryWorkspaceRepository } from '../../../../testing/in-memory-workspace.repository';
import { InMemoryMembershipRepository } from '../../../../testing/in-memory-membership.repository';
import { Role } from '../../../../domain/bounded-contexts/workspaces/value-objects/role';

describe('AddMemberHandler', () => {
  let handler: AddMemberHandler;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let membershipRepo: InMemoryMembershipRepository;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepository();
    membershipRepo = new InMemoryMembershipRepository();
    handler = new AddMemberHandler(workspaceRepo as any, membershipRepo as any);
  });

  it('should add a new member', async () => {
    await workspaceRepo.save({ id: 'ws-1', ownerUserId: 'user-1', name: 'WS', slug: 'ws', isPersonal: false } as any);

    const result = await handler.execute(new AddMemberCommand({
      workspaceId: 'ws-1',
      email: 'new@example.com',
      role: Role.MEMBER,
      actorUserId: 'user-1',
    }));

    expect(result.isOk()).toBe(true);
  });

  it('should fail for invalid email', async () => {
    const result = await handler.execute(new AddMemberCommand({
      workspaceId: 'ws-1',
      email: 'not-an-email',
      role: Role.MEMBER,
      actorUserId: 'user-1',
    }));

    expect(result.isErr()).toBe(true);
  });
});
