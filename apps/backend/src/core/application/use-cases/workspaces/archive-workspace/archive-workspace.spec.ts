/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/archive-workspace/archive-workspace.spec.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Tests for ArchiveWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ArchiveWorkspaceHandler } from './archive-workspace.handler';
import { ArchiveWorkspaceCommand } from './archive-workspace.command';
import { InMemoryWorkspaceRepository } from '../../../../testing/in-memory-workspace.repository';

describe('ArchiveWorkspaceHandler', () => {
  let handler: ArchiveWorkspaceHandler;
  let workspaceRepo: InMemoryWorkspaceRepository;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepository();
    handler = new ArchiveWorkspaceHandler(workspaceRepo as any);
  });

  it('should archive a workspace', async () => {
    await workspaceRepo.save({ id: 'ws-1', ownerUserId: 'user-1', name: 'WS', slug: 'ws', isPersonal: false } as any);

    const result = await handler.execute(new ArchiveWorkspaceCommand({
      workspaceId: 'ws-1',
      actorUserId: 'user-1',
      archive: true,
    }));

    expect(result.isOk()).toBe(true);
  });

  it('should fail when not owner', async () => {
    await workspaceRepo.save({ id: 'ws-1', ownerUserId: 'user-1', name: 'WS', slug: 'ws', isPersonal: false } as any);

    const result = await handler.execute(new ArchiveWorkspaceCommand({
      workspaceId: 'ws-1',
      actorUserId: 'user-2',
      archive: true,
    }));

    expect(result.isErr()).toBe(true);
  });
});
