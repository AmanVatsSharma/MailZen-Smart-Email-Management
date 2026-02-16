import { AiAgentGatewayResolver } from './ai-agent-gateway.resolver';

describe('AiAgentGatewayResolver', () => {
  const gatewayService = {
    assist: jest.fn(),
    getPlatformHealth: jest.fn(),
    resetPlatformRuntimeStats: jest.fn(),
    resetSkillRuntimeStats: jest.fn(),
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
});
