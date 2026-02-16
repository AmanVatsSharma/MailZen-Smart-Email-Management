import { MailboxSyncRunRetentionScheduler } from './mailbox-sync-run-retention.scheduler';
import { MailboxSyncService } from './mailbox-sync.service';

describe('MailboxSyncRunRetentionScheduler', () => {
  const purgeMailboxSyncRunRetentionDataMock = jest.fn();
  const mailboxSyncServiceMock: jest.Mocked<
    Pick<MailboxSyncService, 'purgeMailboxSyncRunRetentionData'>
  > = {
    purgeMailboxSyncRunRetentionData: purgeMailboxSyncRunRetentionDataMock,
  };
  const scheduler = new MailboxSyncRunRetentionScheduler(
    mailboxSyncServiceMock as unknown as MailboxSyncService,
  );
  const originalAutoPurgeEnv =
    process.env.MAILZEN_MAILBOX_SYNC_RUN_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MAILZEN_MAILBOX_SYNC_RUN_AUTOPURGE_ENABLED;
  });

  afterAll(() => {
    if (typeof originalAutoPurgeEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_RUN_AUTOPURGE_ENABLED =
        originalAutoPurgeEnv;
      return;
    }
    delete process.env.MAILZEN_MAILBOX_SYNC_RUN_AUTOPURGE_ENABLED;
  });

  it('purges sync runs when auto-purge is enabled', async () => {
    purgeMailboxSyncRunRetentionDataMock.mockResolvedValue({
      deletedRuns: 5,
      retentionDays: 90,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await scheduler.purgeMailboxSyncRunRetentionData();

    expect(purgeMailboxSyncRunRetentionDataMock).toHaveBeenCalledWith({});
  });

  it('skips sync run auto-purge when disabled', async () => {
    process.env.MAILZEN_MAILBOX_SYNC_RUN_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeMailboxSyncRunRetentionData();

    expect(purgeMailboxSyncRunRetentionDataMock).not.toHaveBeenCalled();
  });
});
