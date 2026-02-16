import { SmartReplyService } from './smart-reply.service';
import { SmartReplyRetentionScheduler } from './smart-reply-retention.scheduler';

describe('SmartReplyRetentionScheduler', () => {
  const purgeHistoryByRetentionPolicyMock = jest.fn();
  const smartReplyServiceMock: jest.Mocked<
    Pick<SmartReplyService, 'purgeHistoryByRetentionPolicy'>
  > = {
    purgeHistoryByRetentionPolicy: purgeHistoryByRetentionPolicyMock,
  };
  const scheduler = new SmartReplyRetentionScheduler(
    smartReplyServiceMock as unknown as SmartReplyService,
  );
  const originalAutoPurgeEnv =
    process.env.MAILZEN_SMART_REPLY_HISTORY_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MAILZEN_SMART_REPLY_HISTORY_AUTOPURGE_ENABLED;
  });

  afterAll(() => {
    if (typeof originalAutoPurgeEnv === 'string') {
      process.env.MAILZEN_SMART_REPLY_HISTORY_AUTOPURGE_ENABLED =
        originalAutoPurgeEnv;
      return;
    }
    delete process.env.MAILZEN_SMART_REPLY_HISTORY_AUTOPURGE_ENABLED;
  });

  it('executes smart reply history purge when enabled', async () => {
    purgeHistoryByRetentionPolicyMock.mockResolvedValue({
      deletedRows: 3,
      retentionDays: 180,
    });

    await scheduler.purgeSmartReplyHistory();

    expect(purgeHistoryByRetentionPolicyMock).toHaveBeenCalledWith({});
  });

  it('skips smart reply history purge when disabled by env', async () => {
    process.env.MAILZEN_SMART_REPLY_HISTORY_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeSmartReplyHistory();

    expect(purgeHistoryByRetentionPolicyMock).not.toHaveBeenCalled();
  });
});
