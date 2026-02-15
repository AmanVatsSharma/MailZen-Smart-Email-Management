import { MailboxService } from './mailbox.service';
import { MailboxInboundRetentionScheduler } from './mailbox-inbound-retention.scheduler';

describe('MailboxInboundRetentionScheduler', () => {
  const purgeInboundEventRetentionDataMock = jest.fn();
  const mailboxServiceMock: jest.Mocked<
    Pick<MailboxService, 'purgeInboundEventRetentionData'>
  > = {
    purgeInboundEventRetentionData: purgeInboundEventRetentionDataMock,
  };
  const scheduler = new MailboxInboundRetentionScheduler(
    mailboxServiceMock as unknown as MailboxService,
  );
  const originalAutoPurgeEnv =
    process.env.MAILZEN_MAILBOX_INBOUND_RETENTION_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MAILZEN_MAILBOX_INBOUND_RETENTION_AUTOPURGE_ENABLED;
  });

  afterAll(() => {
    if (typeof originalAutoPurgeEnv === 'string') {
      process.env.MAILZEN_MAILBOX_INBOUND_RETENTION_AUTOPURGE_ENABLED =
        originalAutoPurgeEnv;
      return;
    }
    delete process.env.MAILZEN_MAILBOX_INBOUND_RETENTION_AUTOPURGE_ENABLED;
  });

  it('purges inbound events when auto-purge enabled', async () => {
    purgeInboundEventRetentionDataMock.mockResolvedValue({
      deletedEvents: 9,
      retentionDays: 180,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await scheduler.purgeMailboxInboundRetentionData();

    expect(purgeInboundEventRetentionDataMock).toHaveBeenCalledWith({});
  });

  it('skips inbound purge when auto-purge disabled', async () => {
    process.env.MAILZEN_MAILBOX_INBOUND_RETENTION_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeMailboxInboundRetentionData();

    expect(purgeInboundEventRetentionDataMock).not.toHaveBeenCalled();
  });
});
