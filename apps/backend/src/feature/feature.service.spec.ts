import { Repository } from 'typeorm';
import { Feature } from './entities/feature.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { FeatureService } from './feature.service';

describe('FeatureService', () => {
  const featureRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const auditLogRepo = {
    create: jest.fn((payload: unknown) => payload as AuditLog),
    save: jest.fn().mockResolvedValue({} as AuditLog),
  };

  const service = new FeatureService(
    featureRepo as unknown as Repository<Feature>,
    auditLogRepo as unknown as Repository<AuditLog>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogRepo.create.mockImplementation((payload: unknown) => payload as AuditLog);
    auditLogRepo.save.mockResolvedValue({} as AuditLog);
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

    const result = await service.createFeature(
      {
        name: 'inbox-ai',
        isActive: true,
      },
      'admin-1',
    );

    expect(result).toEqual({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'GLOBAL',
      targetValue: null,
      rolloutPercentage: 100,
    });
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'feature_flag_created',
      }),
    );
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

    const result = await service.updateFeature(
      {
        id: 'feature-1',
        isActive: true,
      },
      'admin-2',
    );

    expect(result.isActive).toBe(true);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-2',
        action: 'feature_flag_updated',
      }),
    );
  });

  it('throws when deleting missing feature', async () => {
    featureRepo.findOne.mockResolvedValue(null);

    await expect(service.deleteFeature('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('records audit action when deleting feature', async () => {
    featureRepo.findOne.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'GLOBAL',
      targetValue: null,
      rolloutPercentage: 100,
    });
    featureRepo.remove.mockResolvedValue({
      id: 'feature-1',
      name: 'inbox-ai',
      isActive: true,
      targetType: 'GLOBAL',
      targetValue: null,
      rolloutPercentage: 100,
    });

    const result = await service.deleteFeature('feature-1', 'admin-3');

    expect(featureRepo.remove).toHaveBeenCalledTimes(1);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-3',
        action: 'feature_flag_deleted',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'feature-1',
      }),
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

  it('continues feature creation when audit persistence fails', async () => {
    featureRepo.findOne.mockResolvedValue(null);
    featureRepo.create.mockImplementation((data: Record<string, unknown>) => ({
      id: 'feature-99',
      ...data,
    }));
    featureRepo.save.mockResolvedValue({
      id: 'feature-99',
      name: 'inbox-ai-beta',
      isActive: true,
      targetType: 'GLOBAL',
      targetValue: null,
      rolloutPercentage: 100,
    });
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.createFeature(
      {
        name: 'inbox-ai-beta',
        isActive: true,
      },
      'admin-4',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'feature-99',
      }),
    );
  });
});
