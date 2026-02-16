import { AiAgentGatewayResolver } from './ai-agent-gateway.resolver';

describe('AiAgentGatewayResolver', () => {
  const gatewayService = {
    assist: jest.fn(),
    getPlatformHealth: jest.fn(),
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
});
