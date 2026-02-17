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

  it('forwards admin actor to create feature mutation', async () => {
    featureService.createFeature.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
    });

    const result = await resolver.createFeature(
      {
        name: 'inbox-ai',
        isActive: true,
      },
      {
        req: {
          user: {
            id: 'admin-1',
          },
        },
      } as never,
    );

    expect(featureService.createFeature).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'inbox-ai',
        isActive: true,
      }),
      'admin-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'feature-1',
      }),
    );
  });

  it('forwards admin actor to update feature mutation', async () => {
    featureService.updateFeature.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: false,
    });

    const result = await resolver.updateFeature(
      {
        id: 'feature-1',
        isActive: false,
      },
      {
        req: {
          user: {
            id: 'admin-2',
          },
        },
      } as never,
    );

    expect(featureService.updateFeature).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'feature-1',
        isActive: false,
      }),
      'admin-2',
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'feature-1',
      }),
    );
  });

  it('forwards admin actor to delete feature mutation', async () => {
    featureService.deleteFeature.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: false,
    });

    const result = await resolver.deleteFeature(
      'feature-1',
      {
        req: {
          user: {
            id: 'admin-3',
          },
        },
      } as never,
    );

    expect(featureService.deleteFeature).toHaveBeenCalledWith(
      'feature-1',
      'admin-3',
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'feature-1',
      }),
    );
  });
});
