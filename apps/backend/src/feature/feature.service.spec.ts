import { Repository } from 'typeorm';
import { Feature } from './entities/feature.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FeatureService } from './feature.service';

describe('FeatureService', () => {
  const featureRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const service = new FeatureService(
    featureRepo as unknown as Repository<Feature>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new feature when name is unique', async () => {
    featureRepo.findOne.mockResolvedValue(null);
    featureRepo.create.mockImplementation((data: Record<string, unknown>) => ({
      id: 'feature-1',
      ...data,
    }));
    featureRepo.save.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'GLOBAL',
      targetValue: null,
      rolloutPercentage: 100,
    });

    const result = await service.createFeature({
      name: 'inbox-ai',
      isActive: true,
    });

    expect(result).toEqual({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'GLOBAL',
      targetValue: null,
      rolloutPercentage: 100,
    });
  });

  it('rejects duplicate feature names', async () => {
    featureRepo.findOne.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
    });

    await expect(
      service.createFeature({ name: 'inbox-ai', isActive: true }),
    ).rejects.toThrow(ConflictException);
  });

  it('updates existing feature state', async () => {
    featureRepo.findOne.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: false,
      targetType: 'GLOBAL',
      targetValue: null,
      rolloutPercentage: 100,
    });
    featureRepo.save.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'GLOBAL',
      targetValue: null,
      rolloutPercentage: 100,
    });

    const result = await service.updateFeature({
      id: 'feature-1',
      isActive: true,
    });

    expect(result.isActive).toBe(true);
  });

  it('throws when deleting missing feature', async () => {
    featureRepo.findOne.mockResolvedValue(null);

    await expect(service.deleteFeature('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('resolves workspace-targeted feature enablement', async () => {
    featureRepo.findOne.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'WORKSPACE',
      targetValue: 'workspace-1',
      rolloutPercentage: 100,
    });

    const enabled = await service.isFeatureEnabledForContext({
      name: 'inbox-ai',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
    const disabled = await service.isFeatureEnabledForContext({
      name: 'inbox-ai',
      userId: 'user-1',
      workspaceId: 'workspace-2',
    });

    expect(enabled).toBe(true);
    expect(disabled).toBe(false);
  });

  it('applies deterministic rollout percentages', async () => {
    featureRepo.findOne.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'COHORT',
      targetValue: 'early-access',
      rolloutPercentage: 0,
    });

    const disabled = await service.isFeatureEnabledForContext({
      name: 'inbox-ai',
      userId: 'user-1',
      workspaceId: null,
    });
    expect(disabled).toBe(false);

    featureRepo.findOne.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'COHORT',
      targetValue: 'early-access',
      rolloutPercentage: 100,
    });
    const enabled = await service.isFeatureEnabledForContext({
      name: 'inbox-ai',
      userId: 'user-1',
      workspaceId: null,
    });
    expect(enabled).toBe(true);
  });
});
