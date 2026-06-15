/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/export-workspace-data/export-workspace-data.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for ExportWorkspaceData use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ExportWorkspaceDataHandler } from './export-workspace-data.handler';
import { ExportWorkspaceDataCommand } from './export-workspace-data.command';
import { InMemoryWorkspaceRepository } from '../../../../testing/in-memory-workspace.repository';
import { InMemoryMembershipRepository } from '../../../../testing/in-memory-membership.repository';

describe('ExportWorkspaceDataHandler', () => {
  let handler: ExportWorkspaceDataHandler;
  let workspaceRepo: InMemoryWorkspaceRepository;
  let membershipRepo: InMemoryMembershipRepository;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepository();
    membershipRepo = new InMemoryMembershipRepository();
    handler = new ExportWorkspaceDataHandler(workspaceRepo as any, membershipRepo as any);
  });

  it('should export workspace data for owner', async () => {
    await workspaceRepo.save({ id: 'ws-1', ownerUserId: 'user-1', name: 'WS', slug: 'ws', isPersonal: false } as any);
    await membershipRepo.save({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', email: 'u1@x.com', role: 'OWNER', status: 'active', invitedByUserId: 'user-1' } as any);

    const result = await handler.execute(new ExportWorkspaceDataCommand({
      workspaceId: 'ws-1',
      actorUserId: 'user-1',
    }));

    expect(result.isOk()).toBe(true);
    expect(result.value?.memberCount).toBe(1);
  });

  it('should fail when workspace not found', async () => {
    const result = await handler.execute(new ExportWorkspaceDataCommand({
      workspaceId: 'nonexistent',
      actorUserId: 'user-1',
    }));
    expect(result.isErr()).toBe(true);
  });
});
