import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { MailboxSyncRunRetentionScheduler } from './mailbox-sync-run-retention.scheduler';
import { MailboxSyncService } from './mailbox-sync.service';

describe('MailboxSyncRunRetentionScheduler', () => {
  const schedulerActorUserId = 'system:mailbox-sync-run-retention-scheduler';
  const purgeMailboxSyncRunRetentionDataMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();
  const mailboxSyncServiceMock: jest.Mocked<
    Pick<MailboxSyncService, 'purgeMailboxSyncRunRetentionData'>
  > = {
    purgeMailboxSyncRunRetentionData: purgeMailboxSyncRunRetentionDataMock,
  };
  const auditLogRepoMock: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>> =
    {
      create: createAuditLogMock,
      save: saveAuditLogMock,
    };
  const scheduler = new MailboxSyncRunRetentionScheduler(
    mailboxSyncServiceMock as unknown as MailboxSyncService,
    auditLogRepoMock as unknown as Repository<AuditLog>,
  );
  const originalAutoPurgeEnv =
    process.env.MAILZEN_MAILBOX_SYNC_RUN_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLogMock.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
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

    expect(purgeMailboxSyncRunRetentionDataMock).toHaveBeenCalledWith({
      userId: schedulerActorUserId,
    });
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_sync_run_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_sync_run_retention_autopurge_completed',
      }),
    );
  });

  it('skips sync run auto-purge when disabled', async () => {
    process.env.MAILZEN_MAILBOX_SYNC_RUN_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeMailboxSyncRunRetentionData();

    expect(purgeMailboxSyncRunRetentionDataMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_sync_run_retention_autopurge_skipped',
      }),
    );
  });

  it('records failed autopurge audit action when sync-run purge throws', async () => {
    purgeMailboxSyncRunRetentionDataMock.mockRejectedValue(
      new Error('sync run purge failed'),
    );

    await scheduler.purgeMailboxSyncRunRetentionData();

    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_sync_run_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_sync_run_retention_autopurge_failed',
        metadata: expect.objectContaining({
          error: 'sync run purge failed',
        }),
      }),
    );
  });

  it('continues purge flow when scheduler audit writes fail', async () => {
    saveAuditLogMock.mockRejectedValue(new Error('audit datastore unavailable'));
    purgeMailboxSyncRunRetentionDataMock.mockResolvedValue({
      deletedRuns: 5,
      retentionDays: 90,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await expect(
      scheduler.purgeMailboxSyncRunRetentionData(),
    ).resolves.toBeUndefined();

    expect(purgeMailboxSyncRunRetentionDataMock).toHaveBeenCalledWith({
      userId: schedulerActorUserId,
    });
  });
});
