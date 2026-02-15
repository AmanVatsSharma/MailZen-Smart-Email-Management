import { FeatureResolver } from './feature.resolver';

describe('FeatureResolver', () => {
  const featureService = {
    getAllFeatures: jest.fn(),
    createFeature: jest.fn(),
    updateFeature: jest.fn(),
    deleteFeature: jest.fn(),
    isFeatureEnabledForContext: jest.fn(),
  };
  const resolver = new FeatureResolver(featureService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards feature enablement query context', async () => {
    featureService.isFeatureEnabledForContext.mockResolvedValue(true);

    const result = await resolver.isFeatureEnabled(
      'inbox-ai',
      {
        req: {
          user: {
            id: 'user-1',
          },
        },
      } as never,
      'workspace-1',
    );

    expect(result).toBe(true);
    expect(featureService.isFeatureEnabledForContext).toHaveBeenCalledWith({
      name: 'inbox-ai',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });
});
