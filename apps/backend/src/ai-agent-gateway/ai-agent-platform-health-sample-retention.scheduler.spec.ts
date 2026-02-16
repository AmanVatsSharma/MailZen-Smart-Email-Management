import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AiAgentPlatformHealthSampleRetentionScheduler } from './ai-agent-platform-health-sample-retention.scheduler';

describe('AiAgentPlatformHealthSampleRetentionScheduler', () => {
  const schedulerActorUserId =
    'system:agent-platform-health-sample-retention-scheduler';
  const purgePlatformHealthSampleRetentionDataMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();
  const aiAgentGatewayServiceMock: jest.Mocked<
    Pick<AiAgentGatewayService, 'purgePlatformHealthSampleRetentionData'>
  > = {
    purgePlatformHealthSampleRetentionData:
      purgePlatformHealthSampleRetentionDataMock,
  };
  const auditLogRepoMock: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>> =
    {
      create: createAuditLogMock,
      save: saveAuditLogMock,
    };
  const scheduler = new AiAgentPlatformHealthSampleRetentionScheduler(
    aiAgentGatewayServiceMock as unknown as AiAgentGatewayService,
    auditLogRepoMock as unknown as Repository<AuditLog>,
  );
  const originalAutoPurgeEnv =
    process.env.AI_AGENT_HEALTH_SAMPLE_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLogMock.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
    delete process.env.AI_AGENT_HEALTH_SAMPLE_AUTOPURGE_ENABLED;
  });

  afterAll(() => {
    if (typeof originalAutoPurgeEnv === 'string') {
      process.env.AI_AGENT_HEALTH_SAMPLE_AUTOPURGE_ENABLED =
        originalAutoPurgeEnv;
      return;
    }
    delete process.env.AI_AGENT_HEALTH_SAMPLE_AUTOPURGE_ENABLED;
  });

  it('executes health sample retention purge when enabled', async () => {
    purgePlatformHealthSampleRetentionDataMock.mockResolvedValue({
      deletedSamples: 5,
      retentionDays: 30,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await scheduler.purgeExpiredHealthSamples();

    expect(purgePlatformHealthSampleRetentionDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_health_sample_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_health_sample_retention_autopurge_completed',
      }),
    );
  });

  it('skips health sample retention purge when disabled by env', async () => {
    process.env.AI_AGENT_HEALTH_SAMPLE_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeExpiredHealthSamples();

    expect(purgePlatformHealthSampleRetentionDataMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_health_sample_retention_autopurge_skipped',
      }),
    );
  });

  it('records failed autopurge audit action when health-sample purge throws', async () => {
    purgePlatformHealthSampleRetentionDataMock.mockRejectedValue(
      new Error('health sample retention failed'),
    );

    await scheduler.purgeExpiredHealthSamples();

    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_health_sample_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_health_sample_retention_autopurge_failed',
        metadata: expect.objectContaining({
          error: 'health sample retention failed',
        }),
      }),
    );
  });

  it('continues purge flow when scheduler audit writes fail', async () => {
    saveAuditLogMock.mockRejectedValue(new Error('audit datastore unavailable'));
    purgePlatformHealthSampleRetentionDataMock.mockResolvedValue({
      deletedSamples: 5,
      retentionDays: 30,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await expect(scheduler.purgeExpiredHealthSamples()).resolves.toBeUndefined();

    expect(purgePlatformHealthSampleRetentionDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
  });
});
