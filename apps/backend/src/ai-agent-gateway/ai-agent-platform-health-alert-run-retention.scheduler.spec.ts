import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { AiAgentPlatformHealthAlertRunRetentionScheduler } from './ai-agent-platform-health-alert-run-retention.scheduler';
import { AiAgentPlatformHealthAlertScheduler } from './ai-agent-platform-health-alert.scheduler';

describe('AiAgentPlatformHealthAlertRunRetentionScheduler', () => {
  const schedulerActorUserId =
    'system:agent-platform-health-alert-run-retention-scheduler';
  const purgeAlertRunRetentionDataMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();
  const healthAlertSchedulerMock: jest.Mocked<
    Pick<AiAgentPlatformHealthAlertScheduler, 'purgeAlertRunRetentionData'>
  > = {
    purgeAlertRunRetentionData: purgeAlertRunRetentionDataMock,
  };
  const auditLogRepoMock: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>> =
    {
      create: createAuditLogMock,
      save: saveAuditLogMock,
    };
  const scheduler = new AiAgentPlatformHealthAlertRunRetentionScheduler(
    healthAlertSchedulerMock as unknown as AiAgentPlatformHealthAlertScheduler,
    auditLogRepoMock as unknown as Repository<AuditLog>,
  );
  const originalAutoPurgeEnv =
    process.env.AI_AGENT_HEALTH_ALERT_RUN_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLogMock.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
    delete process.env.AI_AGENT_HEALTH_ALERT_RUN_AUTOPURGE_ENABLED;
  });

  afterAll(() => {
    if (typeof originalAutoPurgeEnv === 'string') {
      process.env.AI_AGENT_HEALTH_ALERT_RUN_AUTOPURGE_ENABLED =
        originalAutoPurgeEnv;
      return;
    }
    delete process.env.AI_AGENT_HEALTH_ALERT_RUN_AUTOPURGE_ENABLED;
  });

  it('executes alert run retention purge when enabled', async () => {
    purgeAlertRunRetentionDataMock.mockResolvedValue({
      deletedRuns: 4,
      retentionDays: 120,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await scheduler.purgeExpiredAlertRuns();

    expect(purgeAlertRunRetentionDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_alert_run_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_alert_run_retention_autopurge_completed',
      }),
    );
  });

  it('skips alert run retention purge when disabled by env', async () => {
    process.env.AI_AGENT_HEALTH_ALERT_RUN_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeExpiredAlertRuns();

    expect(purgeAlertRunRetentionDataMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_alert_run_retention_autopurge_skipped',
      }),
    );
  });

  it('records failed autopurge audit action when alert-run purge throws', async () => {
    purgeAlertRunRetentionDataMock.mockRejectedValue(
      new Error('alert run retention failed'),
    );

    await scheduler.purgeExpiredAlertRuns();

    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_alert_run_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_platform_alert_run_retention_autopurge_failed',
        metadata: expect.objectContaining({
          error: 'alert run retention failed',
        }),
      }),
    );
  });

  it('continues purge flow when scheduler audit writes fail', async () => {
    saveAuditLogMock.mockRejectedValue(new Error('audit datastore unavailable'));
    purgeAlertRunRetentionDataMock.mockResolvedValue({
      deletedRuns: 4,
      retentionDays: 120,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await expect(scheduler.purgeExpiredAlertRuns()).resolves.toBeUndefined();

    expect(purgeAlertRunRetentionDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
  });
});
