import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AiAgentActionAuditRetentionScheduler } from './ai-agent-action-audit-retention.scheduler';

describe('AiAgentActionAuditRetentionScheduler', () => {
  const purgeAgentActionAuditRetentionDataMock = jest.fn();
  const aiAgentGatewayServiceMock: jest.Mocked<
    Pick<AiAgentGatewayService, 'purgeAgentActionAuditRetentionData'>
  > = {
    purgeAgentActionAuditRetentionData: purgeAgentActionAuditRetentionDataMock,
  };
  const scheduler = new AiAgentActionAuditRetentionScheduler(
    aiAgentGatewayServiceMock as unknown as AiAgentGatewayService,
  );
  const originalAutoPurgeEnv =
    process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(purgeAgentActionAuditRetentionDataMock).toHaveBeenCalledWith({});
  });

  it('skips retention purge when disabled by env', async () => {
    process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeExpiredAgentActionAudits();

    expect(purgeAgentActionAuditRetentionDataMock).not.toHaveBeenCalled();
  });
});
