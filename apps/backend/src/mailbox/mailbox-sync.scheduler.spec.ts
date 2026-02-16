import { MailboxSyncScheduler } from './mailbox-sync.scheduler';
import { MailboxSyncService } from './mailbox-sync.service';

describe('MailboxSyncScheduler', () => {
  const pollActiveMailboxesMock = jest.fn();
  const mailboxSyncServiceMock: jest.Mocked<
    Pick<MailboxSyncService, 'pollActiveMailboxes'>
  > = {
    pollActiveMailboxes: pollActiveMailboxesMock,
  };
  const scheduler = new MailboxSyncScheduler(
    mailboxSyncServiceMock as unknown as MailboxSyncService,
  );
  const originalSyncEnabledEnv = process.env.MAILZEN_MAILBOX_SYNC_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MAILZEN_MAILBOX_SYNC_ENABLED;
  });

  afterAll(() => {
    if (typeof originalSyncEnabledEnv === 'string') {
      process.env.MAILZEN_MAILBOX_SYNC_ENABLED = originalSyncEnabledEnv;
      return;
    }
    delete process.env.MAILZEN_MAILBOX_SYNC_ENABLED;
  });

  it('executes mailbox sync polling when scheduler is enabled', async () => {
    process.env.MAILZEN_MAILBOX_SYNC_ENABLED = 'true';
    pollActiveMailboxesMock.mockResolvedValue({
      polledMailboxes: 2,
      skippedMailboxes: 0,
      failedMailboxes: 0,
      fetchedMessages: 4,
      acceptedMessages: 3,
      deduplicatedMessages: 1,
      rejectedMessages: 0,
    });

    await scheduler.syncMailboxes();

    expect(pollActiveMailboxesMock).toHaveBeenCalledTimes(1);
  });

  it('skips mailbox sync polling when scheduler is disabled', async () => {
    process.env.MAILZEN_MAILBOX_SYNC_ENABLED = 'false';

    await scheduler.syncMailboxes();

    expect(pollActiveMailboxesMock).not.toHaveBeenCalled();
  });
});
