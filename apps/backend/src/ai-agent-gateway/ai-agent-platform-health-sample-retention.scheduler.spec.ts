import { AiAgentGatewayService } from './ai-agent-gateway.service';
import { AiAgentPlatformHealthSampleRetentionScheduler } from './ai-agent-platform-health-sample-retention.scheduler';

describe('AiAgentPlatformHealthSampleRetentionScheduler', () => {
  const purgePlatformHealthSampleRetentionDataMock = jest.fn();
  const aiAgentGatewayServiceMock: jest.Mocked<
    Pick<AiAgentGatewayService, 'purgePlatformHealthSampleRetentionData'>
  > = {
    purgePlatformHealthSampleRetentionData:
      purgePlatformHealthSampleRetentionDataMock,
  };
  const scheduler = new AiAgentPlatformHealthSampleRetentionScheduler(
    aiAgentGatewayServiceMock as unknown as AiAgentGatewayService,
  );
  const originalAutoPurgeEnv =
    process.env.AI_AGENT_HEALTH_SAMPLE_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(purgePlatformHealthSampleRetentionDataMock).toHaveBeenCalledWith({});
  });

  it('skips health sample retention purge when disabled by env', async () => {
    process.env.AI_AGENT_HEALTH_SAMPLE_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeExpiredHealthSamples();

    expect(purgePlatformHealthSampleRetentionDataMock).not.toHaveBeenCalled();
  });
});
