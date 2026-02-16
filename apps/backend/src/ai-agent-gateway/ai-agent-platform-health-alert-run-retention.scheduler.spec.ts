import { AiAgentPlatformHealthAlertRunRetentionScheduler } from './ai-agent-platform-health-alert-run-retention.scheduler';
import { AiAgentPlatformHealthAlertScheduler } from './ai-agent-platform-health-alert.scheduler';

describe('AiAgentPlatformHealthAlertRunRetentionScheduler', () => {
  const purgeAlertRunRetentionDataMock = jest.fn();
  const healthAlertSchedulerMock: jest.Mocked<
    Pick<AiAgentPlatformHealthAlertScheduler, 'purgeAlertRunRetentionData'>
  > = {
    purgeAlertRunRetentionData: purgeAlertRunRetentionDataMock,
  };
  const scheduler = new AiAgentPlatformHealthAlertRunRetentionScheduler(
    healthAlertSchedulerMock as unknown as AiAgentPlatformHealthAlertScheduler,
  );
  const originalAutoPurgeEnv =
    process.env.AI_AGENT_HEALTH_ALERT_RUN_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(purgeAlertRunRetentionDataMock).toHaveBeenCalledWith({});
  });

  it('skips alert run retention purge when disabled by env', async () => {
    process.env.AI_AGENT_HEALTH_ALERT_RUN_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeExpiredAlertRuns();

    expect(purgeAlertRunRetentionDataMock).not.toHaveBeenCalled();
  });
});
