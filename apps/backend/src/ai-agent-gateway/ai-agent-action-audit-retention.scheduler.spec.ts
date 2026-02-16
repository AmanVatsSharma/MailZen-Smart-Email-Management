import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AiAgentActionAuditRetentionScheduler } from './ai-agent-action-audit-retention.scheduler';

describe('AiAgentActionAuditRetentionScheduler', () => {
  const schedulerActorUserId = 'system:agent-action-audit-retention-scheduler';
  const purgeAgentActionAuditRetentionDataMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();
  const aiAgentGatewayServiceMock: jest.Mocked<
    Pick<AiAgentGatewayService, 'purgeAgentActionAuditRetentionData'>
  > = {
    purgeAgentActionAuditRetentionData: purgeAgentActionAuditRetentionDataMock,
  };
  const auditLogRepoMock: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>> =
    {
      create: createAuditLogMock,
      save: saveAuditLogMock,
    };
  const scheduler = new AiAgentActionAuditRetentionScheduler(
    aiAgentGatewayServiceMock as unknown as AiAgentGatewayService,
    auditLogRepoMock as unknown as Repository<AuditLog>,
  );
  const originalAutoPurgeEnv =
    process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLogMock.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
    delete process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED;
  });

  afterAll(() => {
    if (typeof originalAutoPurgeEnv === 'string') {
      process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED =
        originalAutoPurgeEnv;
      return;
    }
    delete process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED;
  });

  it('executes agent action retention purge when enabled', async () => {
    purgeAgentActionAuditRetentionDataMock.mockResolvedValue({
      deletedRows: 5,
      retentionDays: 365,
      userScoped: false,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await scheduler.purgeExpiredAgentActionAudits();

    expect(purgeAgentActionAuditRetentionDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_action_audit_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_action_audit_retention_autopurge_completed',
      }),
    );
  });

  it('skips retention purge when disabled by env', async () => {
    process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeExpiredAgentActionAudits();

    expect(purgeAgentActionAuditRetentionDataMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_action_audit_retention_autopurge_skipped',
      }),
    );
  });

  it('records failed autopurge audit action when action-audit purge throws', async () => {
    purgeAgentActionAuditRetentionDataMock.mockRejectedValue(
      new Error('action audit retention failed'),
    );

    await scheduler.purgeExpiredAgentActionAudits();

    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_action_audit_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'agent_action_audit_retention_autopurge_failed',
        metadata: expect.objectContaining({
          error: 'action audit retention failed',
        }),
      }),
    );
  });

  it('continues purge flow when scheduler audit writes fail', async () => {
    saveAuditLogMock.mockRejectedValue(new Error('audit datastore unavailable'));
    purgeAgentActionAuditRetentionDataMock.mockResolvedValue({
      deletedRows: 5,
      retentionDays: 365,
      userScoped: false,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await expect(
      scheduler.purgeExpiredAgentActionAudits(),
    ).resolves.toBeUndefined();

    expect(purgeAgentActionAuditRetentionDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
  });
});
