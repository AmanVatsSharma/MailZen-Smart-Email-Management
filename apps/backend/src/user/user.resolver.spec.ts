import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

describe('UserResolver', () => {
  const userServiceMock: jest.Mocked<
    Pick<UserService, 'exportUserDataSnapshot' | 'exportUserDataSnapshotForAdmin'>
  > = {
    exportUserDataSnapshot: jest.fn(),
    exportUserDataSnapshotForAdmin: jest.fn(),
  };
  const resolver = new UserResolver(userServiceMock as unknown as UserService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates myAccountDataExport to user service', async () => {
    userServiceMock.exportUserDataSnapshot.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"user":{"id":"user-1"}}',
    });

    const result = await resolver.myAccountDataExport({
      req: { user: { id: 'user-1' } },
    });

    expect(result.generatedAtIso).toBe('2026-02-16T00:00:00.000Z');
    expect(userServiceMock.exportUserDataSnapshot).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('delegates userAccountDataExport to admin export service method', async () => {
    userServiceMock.exportUserDataSnapshotForAdmin.mockResolvedValue({
      generatedAtIso: '2026-02-16T01:00:00.000Z',
      dataJson: '{"user":{"id":"user-2"}}',
    });

    const result = await resolver.userAccountDataExport('user-2', {
      req: { user: { id: 'admin-1' } },
    });

    expect(result.generatedAtIso).toBe('2026-02-16T01:00:00.000Z');
    expect(userServiceMock.exportUserDataSnapshotForAdmin).toHaveBeenCalledWith(
      {
        targetUserId: 'user-2',
        actorUserId: 'admin-1',
      },
    );
  });
});
