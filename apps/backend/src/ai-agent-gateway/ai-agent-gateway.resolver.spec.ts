import { AiAgentGatewayResolver } from './ai-agent-gateway.resolver';

describe('AiAgentGatewayResolver', () => {
  const gatewayService = {
    assist: jest.fn(),
    getPlatformHealth: jest.fn(),
    getPlatformHealthHistory: jest.fn(),
    exportPlatformHealthSampleData: jest.fn(),
    getPlatformHealthTrendSummary: jest.fn(),
    getPlatformHealthTrendSeries: jest.fn(),
    getPlatformHealthIncidentStats: jest.fn(),
    getPlatformHealthIncidentSeries: jest.fn(),
    exportPlatformHealthIncidentData: jest.fn(),
    resetPlatformRuntimeStats: jest.fn(),
    resetSkillRuntimeStats: jest.fn(),
    purgePlatformHealthSampleRetentionData: jest.fn(),
    listAgentActionAuditsForUser: jest.fn(),
    exportAgentActionDataForUser: jest.fn(),
    purgeAgentActionAuditRetentionData: jest.fn(),
  };
  const healthAlertScheduler = {
    runHealthAlertCheck: jest.fn(),
    getAlertConfigSnapshot: jest.fn(),
    getAlertRunHistory: jest.fn(),
    exportAlertRunHistoryData: jest.fn(),
    purgeAlertRunRetentionData: jest.fn(),
    getAlertDeliveryStats: jest.fn(),
    getAlertDeliverySeries: jest.fn(),
    exportAlertDeliveryData: jest.fn(),
  };
  const resolver = new AiAgentGatewayResolver(
    gatewayService as never,
    healthAlertScheduler as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards user context to myAgentActionAudits', async () => {
    gatewayService.listAgentActionAuditsForUser.mockResolvedValue([]);

    await resolver.myAgentActionAudits(
      {
        req: {
          user: {
            id: 'user-1',
          },
        },
      },
      15,
    );

    expect(gatewayService.listAgentActionAuditsForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 15,
    });
  });

  it('delegates agentPlatformHealth to gateway service', async () => {
    gatewayService.getPlatformHealth.mockResolvedValue({
      status: 'ok',
      reachable: true,
      serviceUrl: 'http://localhost:8100',
      configuredServiceUrls: ['http://localhost:8100'],
      probedServiceUrls: ['http://localhost:8100'],
      endpointStats: [
        {
          endpointUrl: 'http://localhost:8100',
          successCount: 5,
          failureCount: 1,
          lastSuccessAtIso: '2026-02-16T00:00:00.000Z',
          lastFailureAtIso: '2026-02-15T00:00:00.000Z',
        },
      ],
      skillStats: [
        {
          skill: 'auth',
          totalRequests: 10,
          failedRequests: 1,
          timeoutFailures: 0,
          avgLatencyMs: 20,
          lastLatencyMs: 12,
          errorRatePercent: 10,
          lastErrorAtIso: '2026-02-15T00:00:00.000Z',
        },
      ],
      latencyMs: 12,
      checkedAtIso: '2026-02-16T00:00:00.000Z',
      requestCount: 10,
      errorCount: 1,
      timeoutErrorCount: 0,
      errorRatePercent: 10,
      avgLatencyMs: 20,
      latencyWarnMs: 1500,
      errorRateWarnPercent: 5,
      alertingState: 'healthy',
    });

    const result = await resolver.agentPlatformHealth();

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        endpointStats: [
          expect.objectContaining({
            endpointUrl: 'http://localhost:8100',
          }),
        ],
        skillStats: [
          expect.objectContaining({
            skill: 'auth',
          }),
        ],
      }),
    );
    expect(gatewayService.getPlatformHealth).toHaveBeenCalled();
  });

  it('delegates agentPlatformHealthHistory to gateway service', async () => {
    gatewayService.getPlatformHealthHistory.mockResolvedValue([
      {
        status: 'ok',
        reachable: true,
        serviceUrl: 'http://localhost:8100',
        configuredServiceUrls: ['http://localhost:8100'],
        probedServiceUrls: ['http://localhost:8100'],
        endpointStats: [],
        skillStats: [],
        checkedAtIso: '2026-02-16T00:00:00.000Z',
        requestCount: 12,
        errorCount: 1,
        timeoutErrorCount: 0,
        errorRatePercent: 8.33,
        avgLatencyMs: 45,
        latencyWarnMs: 1500,
        errorRateWarnPercent: 5,
        alertingState: 'warn',
      },
    ]);

    const result = await resolver.agentPlatformHealthHistory(30, 48);

    expect(gatewayService.getPlatformHealthHistory).toHaveBeenCalledWith({
      limit: 30,
      windowHours: 48,
    });
    expect(result).toEqual([
      expect.objectContaining({
        status: 'ok',
        requestCount: 12,
      }),
    ]);
  });

  it('delegates agentPlatformHealthSampleDataExport to gateway service', async () => {
    gatewayService.exportPlatformHealthSampleData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"sampleCount":2}',
    });

    const result = await resolver.agentPlatformHealthSampleDataExport(50, 24);

    expect(gatewayService.exportPlatformHealthSampleData).toHaveBeenCalledWith({
      limit: 50,
      windowHours: 24,
    });
    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
  });

  it('delegates agentPlatformHealthTrendSummary to gateway service', async () => {
    gatewayService.getPlatformHealthTrendSummary.mockResolvedValue({
      windowHours: 24,
      sampleCount: 20,
      healthyCount: 14,
      warnCount: 5,
      criticalCount: 1,
      avgErrorRatePercent: 4.5,
      peakErrorRatePercent: 12,
      avgLatencyMs: 210,
      peakLatencyMs: 740,
      latestCheckedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.agentPlatformHealthTrendSummary(24);

    expect(gatewayService.getPlatformHealthTrendSummary).toHaveBeenCalledWith({
      windowHours: 24,
    });
    expect(result).toEqual(
      expect.objectContaining({
        sampleCount: 20,
        criticalCount: 1,
      }),
    );
  });

  it('delegates agentPlatformHealthTrendSeries to gateway service', async () => {
    gatewayService.getPlatformHealthTrendSeries.mockResolvedValue([
      {
        bucketStartIso: '2026-02-16T00:00:00.000Z',
        sampleCount: 4,
        healthyCount: 3,
        warnCount: 1,
        criticalCount: 0,
        avgErrorRatePercent: 2.2,
        avgLatencyMs: 120,
      },
    ]);

    const result = await resolver.agentPlatformHealthTrendSeries(24, 30);

    expect(gatewayService.getPlatformHealthTrendSeries).toHaveBeenCalledWith({
      windowHours: 24,
      bucketMinutes: 30,
    });
    expect(result).toEqual([
      expect.objectContaining({
        sampleCount: 4,
        warnCount: 1,
      }),
    ]);
  });

  it('delegates agentPlatformHealthIncidentStats to gateway service', async () => {
    gatewayService.getPlatformHealthIncidentStats.mockResolvedValue({
      windowHours: 24,
      totalCount: 6,
      warnCount: 4,
      criticalCount: 2,
      lastIncidentAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.agentPlatformHealthIncidentStats(24);

    expect(gatewayService.getPlatformHealthIncidentStats).toHaveBeenCalledWith({
      windowHours: 24,
    });
    expect(result).toEqual(
      expect.objectContaining({
        totalCount: 6,
        criticalCount: 2,
      }),
    );
  });

  it('delegates agentPlatformHealthIncidentSeries to gateway service', async () => {
    gatewayService.getPlatformHealthIncidentSeries.mockResolvedValue([
      {
        bucketStartIso: '2026-02-16T00:00:00.000Z',
        totalCount: 2,
        warnCount: 1,
        criticalCount: 1,
      },
    ]);

    const result = await resolver.agentPlatformHealthIncidentSeries(24, 30);

    expect(gatewayService.getPlatformHealthIncidentSeries).toHaveBeenCalledWith(
      {
        windowHours: 24,
        bucketMinutes: 30,
      },
    );
    expect(result).toEqual([
      expect.objectContaining({
        totalCount: 2,
        criticalCount: 1,
      }),
    ]);
  });

  it('delegates agentPlatformHealthIncidentDataExport to gateway service', async () => {
    gatewayService.exportPlatformHealthIncidentData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"stats":{"totalCount":3}}',
    });

    const result = await resolver.agentPlatformHealthIncidentDataExport(24, 30);

    expect(
      gatewayService.exportPlatformHealthIncidentData,
    ).toHaveBeenCalledWith({
      windowHours: 24,
      bucketMinutes: 30,
    });
    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
  });

  it('delegates runAgentPlatformHealthAlertCheck to health alert scheduler', async () => {
    healthAlertScheduler.runHealthAlertCheck.mockResolvedValue({
      alertsEnabled: true,
      evaluatedAtIso: '2026-02-16T00:00:00.000Z',
      windowHours: 6,
      baselineWindowHours: 72,
      cooldownMinutes: 60,
      minSampleCount: 4,
      severity: 'WARNING',
      reasons: ['warn-samples-detected'],
      recipientCount: 2,
      publishedCount: 1,
    });

    const result = await resolver.runAgentPlatformHealthAlertCheck(
      6,
      72,
      60,
      4,
    );

    expect(healthAlertScheduler.runHealthAlertCheck).toHaveBeenCalledWith({
      windowHours: 6,
      baselineWindowHours: 72,
      cooldownMinutes: 60,
      minSampleCount: 4,
    });
    expect(result).toEqual(
      expect.objectContaining({
        alertsEnabled: true,
        publishedCount: 1,
      }),
    );
  });

  it('delegates purgeAgentPlatformHealthAlertRunRetentionData to health alert scheduler', async () => {
    healthAlertScheduler.purgeAlertRunRetentionData.mockResolvedValue({
      deletedRuns: 12,
      retentionDays: 120,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result =
      await resolver.purgeAgentPlatformHealthAlertRunRetentionData(120);

    expect(
      healthAlertScheduler.purgeAlertRunRetentionData,
    ).toHaveBeenCalledWith({
      retentionDays: 120,
    });
    expect(result).toEqual(
      expect.objectContaining({
        deletedRuns: 12,
        retentionDays: 120,
      }),
    );
  });

  it('delegates agentPlatformHealthAlertDeliveryStats to health alert scheduler', async () => {
    healthAlertScheduler.getAlertDeliveryStats.mockResolvedValue({
      windowHours: 24,
      totalCount: 8,
      warningCount: 5,
      criticalCount: 3,
      uniqueRecipients: 2,
      lastAlertAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.agentPlatformHealthAlertDeliveryStats(24);

    expect(healthAlertScheduler.getAlertDeliveryStats).toHaveBeenCalledWith({
      windowHours: 24,
    });
    expect(result).toEqual(
      expect.objectContaining({
        totalCount: 8,
        criticalCount: 3,
      }),
    );
  });

  it('delegates agentPlatformHealthAlertDeliverySeries to health alert scheduler', async () => {
    healthAlertScheduler.getAlertDeliverySeries.mockResolvedValue([
      {
        bucketStartIso: '2026-02-16T00:00:00.000Z',
        totalCount: 3,
        warningCount: 2,
        criticalCount: 1,
        uniqueRecipients: 2,
      },
    ]);

    const result = await resolver.agentPlatformHealthAlertDeliverySeries(
      24,
      30,
    );

    expect(healthAlertScheduler.getAlertDeliverySeries).toHaveBeenCalledWith({
      windowHours: 24,
      bucketMinutes: 30,
    });
    expect(result).toEqual([
      expect.objectContaining({
        totalCount: 3,
        uniqueRecipients: 2,
      }),
    ]);
  });

  it('delegates agentPlatformHealthAlertDeliveryDataExport to health alert scheduler', async () => {
    healthAlertScheduler.exportAlertDeliveryData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"stats":{"totalCount":5}}',
    });

    const result = await resolver.agentPlatformHealthAlertDeliveryDataExport(
      24,
      60,
    );

    expect(healthAlertScheduler.exportAlertDeliveryData).toHaveBeenCalledWith({
      windowHours: 24,
      bucketMinutes: 60,
    });
    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
  });

  it('delegates agentPlatformHealthAlertConfig to health alert scheduler', () => {
    healthAlertScheduler.getAlertConfigSnapshot.mockReturnValue({
      alertsEnabled: true,
      scanAdminUsers: true,
      configuredRecipientUserIds: ['ops-1'],
      windowHours: 6,
      baselineWindowHours: 72,
      cooldownMinutes: 60,
      minSampleCount: 4,
      anomalyMultiplier: 2,
      anomalyMinErrorDeltaPercent: 1,
      anomalyMinLatencyDeltaMs: 150,
      errorRateWarnPercent: 5,
      latencyWarnMs: 1500,
      maxDeliverySampleScan: 10000,
      evaluatedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = resolver.agentPlatformHealthAlertConfig();

    expect(healthAlertScheduler.getAlertConfigSnapshot).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        alertsEnabled: true,
        windowHours: 6,
      }),
    );
  });

  it('delegates agentPlatformHealthAlertRunHistory to health alert scheduler', async () => {
    healthAlertScheduler.getAlertRunHistory.mockResolvedValue([
      {
        alertsEnabled: true,
        severity: 'CRITICAL',
        reasons: ['critical-samples-detected'],
        windowHours: 6,
        baselineWindowHours: 72,
        cooldownMinutes: 60,
        minSampleCount: 4,
        anomalyMultiplier: 2,
        anomalyMinErrorDeltaPercent: 1,
        anomalyMinLatencyDeltaMs: 150,
        errorRateWarnPercent: 5,
        latencyWarnMs: 1500,
        recipientCount: 2,
        publishedCount: 2,
        evaluatedAtIso: '2026-02-16T00:00:00.000Z',
      },
    ]);

    const result = await resolver.agentPlatformHealthAlertRunHistory(50, 24);

    expect(healthAlertScheduler.getAlertRunHistory).toHaveBeenCalledWith({
      limit: 50,
      windowHours: 24,
    });
    expect(result).toEqual([
      expect.objectContaining({
        severity: 'CRITICAL',
        publishedCount: 2,
      }),
    ]);
  });

  it('delegates agentPlatformHealthAlertRunHistoryDataExport to health alert scheduler', async () => {
    healthAlertScheduler.exportAlertRunHistoryData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"runCount":3}',
    });

    const result = await resolver.agentPlatformHealthAlertRunHistoryDataExport(
      50,
      24,
    );

    expect(healthAlertScheduler.exportAlertRunHistoryData).toHaveBeenCalledWith(
      {
        limit: 50,
        windowHours: 24,
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
  });

  it('forwards user context to myAgentActionDataExport', async () => {
    gatewayService.exportAgentActionDataForUser.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"summary":{"totalAudits":1}}',
    });

    const result = await resolver.myAgentActionDataExport(
      {
        req: {
          user: {
            id: 'user-1',
          },
        },
      },
      150,
    );

    expect(result).toEqual(
      expect.objectContaining({
        generatedAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
    expect(gatewayService.exportAgentActionDataForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 150,
    });
  });

  it('forwards args to purgeAgentActionRetentionData', async () => {
    gatewayService.purgeAgentActionAuditRetentionData.mockResolvedValue({
      deletedRows: 2,
      retentionDays: 365,
      userScoped: true,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.purgeAgentActionRetentionData(365, 'user-1');

    expect(result).toEqual(
      expect.objectContaining({
        deletedRows: 2,
      }),
    );
    expect(
      gatewayService.purgeAgentActionAuditRetentionData,
    ).toHaveBeenCalledWith({
      retentionDays: 365,
      userId: 'user-1',
    });
  });

  it('forwards endpointUrl to resetAgentPlatformRuntimeStats', async () => {
    gatewayService.resetPlatformRuntimeStats.mockResolvedValue({
      clearedEndpoints: 2,
      scopedEndpointUrl: null,
      resetAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.resetAgentPlatformRuntimeStats(
      'http://localhost:8100',
    );

    expect(result).toEqual(
      expect.objectContaining({
        clearedEndpoints: 2,
      }),
    );
    expect(gatewayService.resetPlatformRuntimeStats).toHaveBeenCalledWith({
      endpointUrl: 'http://localhost:8100',
    });
  });

  it('forwards skill to resetAgentPlatformSkillRuntimeStats', async () => {
    gatewayService.resetSkillRuntimeStats.mockResolvedValue({
      clearedSkills: 3,
      scopedSkill: 'inbox',
      resetAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.resetAgentPlatformSkillRuntimeStats('inbox');

    expect(result).toEqual(
      expect.objectContaining({
        clearedSkills: 3,
      }),
    );
    expect(gatewayService.resetSkillRuntimeStats).toHaveBeenCalledWith({
      skill: 'inbox',
    });
  });

  it('forwards args to purgeAgentPlatformHealthSampleRetentionData', async () => {
    gatewayService.purgePlatformHealthSampleRetentionData.mockResolvedValue({
      deletedSamples: 4,
      retentionDays: 30,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result =
      await resolver.purgeAgentPlatformHealthSampleRetentionData(45);

    expect(result).toEqual(
      expect.objectContaining({
        deletedSamples: 4,
      }),
    );
    expect(
      gatewayService.purgePlatformHealthSampleRetentionData,
    ).toHaveBeenCalledWith({
      retentionDays: 45,
    });
  });
});
