import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InboxResolver } from './inbox.resolver';
import { InboxService } from './inbox.service';

describe('InboxResolver', () => {
  let resolver: InboxResolver;
  const inboxServiceMock = {
    listUserInboxes: jest.fn(),
    setActiveInbox: jest.fn(),
    syncUserInboxes: jest.fn(),
    getInboxSourceHealthStats: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InboxResolver,
        {
          provide: InboxService,
          useValue: inboxServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = moduleRef.get<InboxResolver>(InboxResolver);
  });

  it('returns inbox list for current user', async () => {
    inboxServiceMock.listUserInboxes.mockResolvedValue([{ id: 'inbox-1' }]);
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myInboxes(context);

    expect(result).toEqual([{ id: 'inbox-1' }]);
    expect(inboxServiceMock.listUserInboxes).toHaveBeenCalledWith('user-1');
  });

  it('delegates setActiveInbox to service', async () => {
    inboxServiceMock.setActiveInbox.mockResolvedValue([{ id: 'inbox-1' }]);
    const context = { req: { user: { id: 'user-1' } } };

    await resolver.setActiveInbox(
      {
        type: 'PROVIDER',
        id: 'provider-1',
      },
      context,
    );

    expect(inboxServiceMock.setActiveInbox).toHaveBeenCalledWith(
      'user-1',
      'PROVIDER',
      'provider-1',
    );
  });

  it('delegates syncMyInboxes mutation to service', async () => {
    inboxServiceMock.syncUserInboxes.mockResolvedValue({
      success: true,
      mailboxPolledMailboxes: 1,
      providerRequestedProviders: 1,
    });
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.syncMyInboxes('workspace-1', context);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
    expect(inboxServiceMock.syncUserInboxes).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('delegates myInboxSourceHealthStats query to service', async () => {
    inboxServiceMock.getInboxSourceHealthStats.mockResolvedValue({
      totalInboxes: 4,
      connectedInboxes: 3,
      windowHours: 24,
      executedAtIso: new Date().toISOString(),
    });
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myInboxSourceHealthStats(
      'workspace-9',
      48,
      context,
    );

    expect(result).toEqual(expect.objectContaining({ totalInboxes: 4 }));
    expect(inboxServiceMock.getInboxSourceHealthStats).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-9',
      windowHours: 48,
    });
  });
});
