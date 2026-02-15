import { AiAgentGatewayResolver } from './ai-agent-gateway.resolver';

describe('AiAgentGatewayResolver', () => {
  const gatewayService = {
    assist: jest.fn(),
    getPlatformHealth: jest.fn(),
    listAgentActionAuditsForUser: jest.fn(),
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
});
