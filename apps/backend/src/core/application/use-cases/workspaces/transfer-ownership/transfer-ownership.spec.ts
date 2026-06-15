/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/transfer-ownership/transfer-ownership.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for TransferOwnership use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { TransferOwnershipHandler } from './transfer-ownership.handler';
import { TransferOwnershipCommand } from './transfer-ownership.command';
import { InMemoryWorkspaceRepository } from '../../../../testing/in-memory-workspace.repository';
import { InMemoryMembershipRepository } from '../../../../testing/in-memory-membership.repository';

describe('TransferOwnershipHandler', () => {
  let handler: TransferOwnershipHandler;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let membershipRepo: InMemoryMembershipRepository;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepository();
    membershipRepo = new InMemoryMembershipRepository();
    handler = new TransferOwnershipHandler(workspaceRepo as any, membershipRepo as any);
  });

  it('should fail when workspace does not exist', async () => {
    const result = await handler.execute(new TransferOwnershipCommand({
      workspaceId: 'nonexistent',
      newOwnerUserId: 'user-2',
      actorUserId: 'user-1',
    }));
    expect(result.isErr()).toBe(true);
  });

  it('should fail when actor is not current owner', async () => {
    await workspaceRepo.save({ id: 'ws-1', ownerUserId: 'user-1', name: 'WS', slug: 'ws', isPersonal: false } as any);
    const result = await handler.execute(new TransferOwnershipCommand({
      workspaceId: 'ws-1',
      newOwnerUserId: 'user-2',
      actorUserId: 'user-3',
    }));
    expect(result.isErr()).toBe(true);
  });
});
