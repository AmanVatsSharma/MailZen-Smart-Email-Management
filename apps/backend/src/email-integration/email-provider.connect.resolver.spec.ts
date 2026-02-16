import { Test, TestingModule } from '@nestjs/testing';
import { EmailProviderConnectResolver } from './email-provider.connect.resolver';
import { EmailProviderService } from './email-provider.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('EmailProviderConnectResolver', () => {
  let resolver: EmailProviderConnectResolver;

  const emailProviderServiceMock = {
    connectGmail: jest.fn(),
    connectOutlook: jest.fn(),
    connectSmtp: jest.fn(),
    disconnectProvider: jest.fn(),
    setActiveProvider: jest.fn(),
    syncProvider: jest.fn(),
    syncUserProviders: jest.fn(),
    getProviderSyncStatsForUser: jest.fn(),
    exportProviderSyncDataForUser: jest.fn(),
    listProvidersUi: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderConnectResolver,
        { provide: EmailProviderService, useValue: emailProviderServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = moduleRef.get(EmailProviderConnectResolver);
  });

  it('delegates syncProvider to email provider service', async () => {
    emailProviderServiceMock.syncProvider.mockResolvedValue({
      id: 'provider-1',
      status: 'connected',
    });

    const context = { req: { user: { id: 'user-1' } } };
    const result = await resolver.syncProvider('provider-1', context);

    expect(result).toEqual({
      id: 'provider-1',
      status: 'connected',
    });
    expect(emailProviderServiceMock.syncProvider).toHaveBeenCalledWith(
      'provider-1',
      'user-1',
    );
  });

  it('passes workspace filter to providers query', async () => {
    emailProviderServiceMock.listProvidersUi.mockResolvedValue([
      { id: 'provider-1' },
    ]);
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.providers('workspace-1', context);

    expect(result).toEqual([{ id: 'provider-1' }]);
    expect(emailProviderServiceMock.listProvidersUi).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );
  });

  it('delegates syncMyProviders batch mutation to service', async () => {
    emailProviderServiceMock.syncUserProviders.mockResolvedValue({
      requestedProviders: 2,
      syncedProviders: 1,
      failedProviders: 1,
      skippedProviders: 0,
      results: [],
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.syncMyProviders(
      'workspace-1',
      'provider-1',
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        requestedProviders: 2,
        failedProviders: 1,
      }),
    );
    expect(emailProviderServiceMock.syncUserProviders).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      providerId: 'provider-1',
    });
  });

  it('delegates provider sync stats query to service', async () => {
    emailProviderServiceMock.getProviderSyncStatsForUser.mockResolvedValue({
      totalProviders: 3,
      connectedProviders: 2,
      syncingProviders: 0,
      errorProviders: 1,
      recentlySyncedProviders: 2,
      recentlyErroredProviders: 1,
      windowHours: 24,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myProviderSyncStats(
      'workspace-1',
      24,
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        totalProviders: 3,
        errorProviders: 1,
      }),
    );
    expect(
      emailProviderServiceMock.getProviderSyncStatsForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
    });
  });

  it('delegates provider sync data export query to service', async () => {
    emailProviderServiceMock.exportProviderSyncDataForUser.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"summary":{"totalProviders":1}}',
    });
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myProviderSyncDataExport(
      'workspace-1',
      150,
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
    expect(
      emailProviderServiceMock.exportProviderSyncDataForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      limit: 150,
    });
  });
});
