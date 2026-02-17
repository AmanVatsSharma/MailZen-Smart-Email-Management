import { Test, TestingModule } from '@nestjs/testing';
import { EmailProviderConnectResolver } from './email-provider.connect.resolver';
import { EmailProviderService } from './email-provider.service';
import { ProviderSyncIncidentScheduler } from './provider-sync-incident.scheduler';
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
    exportProviderSyncDataForAdmin: jest.fn(),
    getProviderSyncAlertDeliveryStatsForUser: jest.fn(),
    getProviderSyncAlertDeliverySeriesForUser: jest.fn(),
    getProviderSyncAlertsForUser: jest.fn(),
    exportProviderSyncAlertDeliveryDataForUser: jest.fn(),
    getProviderSyncIncidentAlertDeliveryStatsForUser: jest.fn(),
    getProviderSyncIncidentAlertDeliverySeriesForUser: jest.fn(),
    getProviderSyncIncidentAlertsForUser: jest.fn(),
    exportProviderSyncIncidentAlertDeliveryDataForUser: jest.fn(),
    exportProviderSyncIncidentAlertHistoryDataForUser: jest.fn(),
    listProvidersUi: jest.fn(),
  };
  const providerSyncIncidentSchedulerMock = {
    getIncidentAlertConfigSnapshot: jest.fn(),
    runIncidentAlertCheck: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderConnectResolver,
        { provide: EmailProviderService, useValue: emailProviderServiceMock },
        {
          provide: ProviderSyncIncidentScheduler,
          useValue: providerSyncIncidentSchedulerMock,
        },
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

  it('delegates admin provider sync data export query to service', async () => {
    emailProviderServiceMock.exportProviderSyncDataForAdmin.mockResolvedValue({
      generatedAtIso: '2026-02-16T01:00:00.000Z',
      dataJson: '{"summary":{"totalProviders":2}}',
    });
    const context = { req: { user: { id: 'admin-1' } } };

    const result = await resolver.userProviderSyncDataExport(
      'user-2',
      'workspace-1',
      220,
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T01:00:00.000Z',
      }),
    );
    expect(
      emailProviderServiceMock.exportProviderSyncDataForAdmin,
    ).toHaveBeenCalledWith({
      targetUserId: 'user-2',
      actorUserId: 'admin-1',
      workspaceId: 'workspace-1',
      limit: 220,
    });
  });

  it('delegates provider sync alert delivery stats query to service', async () => {
    emailProviderServiceMock.getProviderSyncAlertDeliveryStatsForUser.mockResolvedValue(
      {
        workspaceId: 'workspace-1',
        windowHours: 24,
        totalAlerts: 5,
        failedAlerts: 3,
        recoveredAlerts: 2,
        lastAlertAtIso: '2026-02-16T00:00:00.000Z',
      },
    );
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myProviderSyncAlertDeliveryStats(
      'workspace-1',
      24,
      context,
    );

    expect(result).toEqual(expect.objectContaining({ totalAlerts: 5 }));
    expect(
      emailProviderServiceMock.getProviderSyncAlertDeliveryStatsForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
    });
  });

  it('delegates provider sync alert delivery series query to service', async () => {
    emailProviderServiceMock.getProviderSyncAlertDeliverySeriesForUser.mockResolvedValue(
      [],
    );
    const context = { req: { user: { id: 'user-1' } } };

    await resolver.myProviderSyncAlertDeliverySeries(
      'workspace-1',
      24,
      60,
      context,
    );

    expect(
      emailProviderServiceMock.getProviderSyncAlertDeliverySeriesForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
    });
  });

  it('delegates provider sync alerts query to service', async () => {
    emailProviderServiceMock.getProviderSyncAlertsForUser.mockResolvedValue([]);
    const context = { req: { user: { id: 'user-1' } } };

    await resolver.myProviderSyncAlerts('workspace-1', 24, 50, context);

    expect(
      emailProviderServiceMock.getProviderSyncAlertsForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      limit: 50,
    });
  });

  it('delegates provider sync alert delivery export query to service', async () => {
    emailProviderServiceMock.exportProviderSyncAlertDeliveryDataForUser.mockResolvedValue(
      {
        generatedAtIso: '2026-02-16T00:00:00.000Z',
        dataJson: '{"stats":{"totalAlerts":5}}',
      },
    );
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myProviderSyncAlertDeliveryDataExport(
      'workspace-1',
      24,
      60,
      100,
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
    expect(
      emailProviderServiceMock.exportProviderSyncAlertDeliveryDataForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
      limit: 100,
    });
  });

  it('delegates provider sync incident alert delivery stats query to service', async () => {
    emailProviderServiceMock.getProviderSyncIncidentAlertDeliveryStatsForUser.mockResolvedValue(
      {
        workspaceId: 'workspace-1',
        windowHours: 24,
        totalAlerts: 3,
        warningAlerts: 2,
        criticalAlerts: 1,
        lastAlertAtIso: '2026-02-16T00:00:00.000Z',
      },
    );
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myProviderSyncIncidentAlertDeliveryStats(
      'workspace-1',
      24,
      context,
    );

    expect(result).toEqual(expect.objectContaining({ totalAlerts: 3 }));
    expect(
      emailProviderServiceMock.getProviderSyncIncidentAlertDeliveryStatsForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
    });
  });

  it('delegates provider sync incident alert delivery series query to service', async () => {
    emailProviderServiceMock.getProviderSyncIncidentAlertDeliverySeriesForUser.mockResolvedValue(
      [],
    );
    const context = { req: { user: { id: 'user-1' } } };

    await resolver.myProviderSyncIncidentAlertDeliverySeries(
      'workspace-1',
      24,
      60,
      context,
    );

    expect(
      emailProviderServiceMock.getProviderSyncIncidentAlertDeliverySeriesForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
    });
  });

  it('delegates provider sync incident alerts query to service', async () => {
    emailProviderServiceMock.getProviderSyncIncidentAlertsForUser.mockResolvedValue(
      [],
    );
    const context = { req: { user: { id: 'user-1' } } };

    await resolver.myProviderSyncIncidentAlerts(
      'workspace-1',
      24,
      100,
      context,
    );

    expect(
      emailProviderServiceMock.getProviderSyncIncidentAlertsForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      limit: 100,
    });
  });

  it('delegates provider sync incident alert delivery export query to service', async () => {
    emailProviderServiceMock.exportProviderSyncIncidentAlertDeliveryDataForUser.mockResolvedValue(
      {
        generatedAtIso: '2026-02-16T00:00:00.000Z',
        dataJson: '{"stats":{"totalAlerts":3}}',
      },
    );
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myProviderSyncIncidentAlertDeliveryDataExport(
      'workspace-1',
      24,
      60,
      100,
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
    expect(
      emailProviderServiceMock.exportProviderSyncIncidentAlertDeliveryDataForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
      limit: 100,
    });
  });

  it('delegates provider sync incident alert history export query to service', async () => {
    emailProviderServiceMock.exportProviderSyncIncidentAlertHistoryDataForUser.mockResolvedValue(
      {
        generatedAtIso: '2026-02-16T00:00:00.000Z',
        dataJson: '{"alertCount":3}',
      },
    );
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.myProviderSyncIncidentAlertHistoryDataExport(
      'workspace-1',
      24,
      50,
      context,
    );

    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
    expect(
      emailProviderServiceMock.exportProviderSyncIncidentAlertHistoryDataForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      limit: 50,
    });
  });

  it('returns provider sync incident alert config snapshot', () => {
    providerSyncIncidentSchedulerMock.getIncidentAlertConfigSnapshot.mockReturnValue(
      {
        alertsEnabled: true,
        syncFailureEnabled: true,
        windowHours: 24,
        cooldownMinutes: 60,
        maxUsersPerRun: 500,
        warningErrorProviderPercent: 20,
        criticalErrorProviderPercent: 50,
        minErrorProviders: 1,
        evaluatedAtIso: '2026-02-16T00:00:00.000Z',
      },
    );

    const context = { req: { user: { id: 'user-1' } } };
    const result = resolver.myProviderSyncIncidentAlertConfig(context);

    expect(
      providerSyncIncidentSchedulerMock.getIncidentAlertConfigSnapshot,
    ).toHaveBeenCalledWith({ userId: 'user-1' });
    return expect(result).resolves.toEqual(
      expect.objectContaining({
        alertsEnabled: true,
        syncFailureEnabled: true,
        windowHours: 24,
      }),
    );
  });

  it('delegates provider sync incident alert check mutation to scheduler', async () => {
    providerSyncIncidentSchedulerMock.runIncidentAlertCheck.mockResolvedValue({
      alertsEnabled: true,
      syncFailureEnabled: true,
      evaluatedAtIso: '2026-02-16T00:00:00.000Z',
      windowHours: 24,
      warningErrorProviderPercent: 20,
      criticalErrorProviderPercent: 50,
      minErrorProviders: 1,
      status: 'WARNING',
      statusReason: 'error-provider-percent 33% >= 20%',
      shouldAlert: true,
      totalProviders: 3,
      connectedProviders: 1,
      syncingProviders: 1,
      errorProviders: 1,
      errorProviderPercent: 33.33,
    });
    const context = { req: { user: { id: 'user-1' } } };

    const result = await resolver.runMyProviderSyncIncidentAlertCheck(
      context,
      24,
      20,
      50,
      1,
    );

    expect(
      providerSyncIncidentSchedulerMock.runIncidentAlertCheck,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      windowHours: 24,
      warningErrorProviderPercent: 20,
      criticalErrorProviderPercent: 50,
      minErrorProviders: 1,
    });
    expect(result.status).toBe('WARNING');
    expect(result.shouldAlert).toBe(true);
  });
});
