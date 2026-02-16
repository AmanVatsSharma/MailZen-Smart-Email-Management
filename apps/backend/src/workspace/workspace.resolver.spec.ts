import { WorkspaceResolver } from './workspace.resolver';

describe('WorkspaceResolver', () => {
  const workspaceServiceMock = {
    exportWorkspaceData: jest.fn(),
    exportWorkspaceDataForAdmin: jest.fn(),
    listPendingWorkspaceInvitations: jest.fn(),
    respondToWorkspaceInvitation: jest.fn(),
    updateWorkspaceMemberRole: jest.fn(),
    removeWorkspaceMember: jest.fn(),
  };

  const resolver = new WorkspaceResolver(workspaceServiceMock as any);
  const context = { req: { user: { id: 'user-1' } } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards pending invitation query to workspace service', async () => {
    workspaceServiceMock.listPendingWorkspaceInvitations.mockResolvedValue([
      { id: 'member-1' },
    ]);

    const result = await resolver.myPendingWorkspaceInvitations(context as any);

    expect(result).toEqual([{ id: 'member-1' }]);
    expect(
      workspaceServiceMock.listPendingWorkspaceInvitations,
    ).toHaveBeenCalledWith('user-1');
  });

  it('forwards workspace data export query to workspace service', async () => {
    workspaceServiceMock.exportWorkspaceData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"workspace":{"id":"workspace-1"}}',
    });

    const result = await resolver.myWorkspaceDataExport(
      'workspace-1',
      context as any,
    );

    expect(result.generatedAtIso).toBe('2026-02-16T00:00:00.000Z');
    expect(workspaceServiceMock.exportWorkspaceData).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
  });

  it('forwards admin workspace data export query to workspace service', async () => {
    workspaceServiceMock.exportWorkspaceDataForAdmin.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:30:00.000Z',
      dataJson: '{"workspace":{"id":"workspace-1"}}',
    });

    const result = await resolver.workspaceDataExportAsAdmin(
      'workspace-1',
      context as any,
    );

    expect(result.generatedAtIso).toBe('2026-02-16T00:30:00.000Z');
    expect(workspaceServiceMock.exportWorkspaceDataForAdmin).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        actorUserId: 'user-1',
      },
    );
  });

  it('forwards invitation response mutation to workspace service', async () => {
    workspaceServiceMock.respondToWorkspaceInvitation.mockResolvedValue({
      id: 'member-1',
      status: 'active',
    });

    const result = await resolver.respondWorkspaceInvitation(
      'member-1',
      true,
      context as any,
    );

    expect(result).toEqual({
      id: 'member-1',
      status: 'active',
    });
    expect(
      workspaceServiceMock.respondToWorkspaceInvitation,
    ).toHaveBeenCalledWith({
      workspaceMemberId: 'member-1',
      userId: 'user-1',
      accept: true,
    });
  });

  it('forwards role update mutation to workspace service', async () => {
    workspaceServiceMock.updateWorkspaceMemberRole.mockResolvedValue({
      id: 'member-1',
      role: 'ADMIN',
    });

    const result = await resolver.updateWorkspaceMemberRole(
      'member-1',
      'ADMIN',
      context as any,
    );

    expect(result).toEqual({
      id: 'member-1',
      role: 'ADMIN',
    });
    expect(workspaceServiceMock.updateWorkspaceMemberRole).toHaveBeenCalledWith(
      {
        workspaceMemberId: 'member-1',
        actorUserId: 'user-1',
        role: 'ADMIN',
      },
    );
  });

  it('forwards remove member mutation to workspace service', async () => {
    workspaceServiceMock.removeWorkspaceMember.mockResolvedValue({
      id: 'member-1',
      status: 'removed',
    });

    const result = await resolver.removeWorkspaceMember(
      'member-1',
      context as any,
    );

    expect(result).toEqual({
      id: 'member-1',
      status: 'removed',
    });
    expect(workspaceServiceMock.removeWorkspaceMember).toHaveBeenCalledWith({
      workspaceMemberId: 'member-1',
      actorUserId: 'user-1',
    });
  });
});
