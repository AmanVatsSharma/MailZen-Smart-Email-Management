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
    resetPlatformRuntimeStats: jest.fn(),
    resetSkillRuntimeStats: jest.fn(),
    purgePlatformHealthSampleRetentionData: jest.fn(),
    listAgentActionAuditsForUser: jest.fn(),
    exportAgentActionDataForUser: jest.fn(),
    purgeAgentActionAuditRetentionData: jest.fn(),
  };
  const resolver = new AiAgentGatewayResolver(gatewayService as never);

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
