import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplyRetentionScheduler } from './smart-reply-retention.scheduler';

describe('SmartReplyRetentionScheduler', () => {
  const schedulerActorUserId = 'system:smart-reply-retention-scheduler';
  const purgeHistoryByRetentionPolicyMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();
  const smartReplyServiceMock: jest.Mocked<
    Pick<SmartReplyService, 'purgeHistoryByRetentionPolicy'>
  > = {
    purgeHistoryByRetentionPolicy: purgeHistoryByRetentionPolicyMock,
  };
  const auditLogRepoMock: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>> =
    {
      create: createAuditLogMock,
      save: saveAuditLogMock,
    };
  const scheduler = new SmartReplyRetentionScheduler(
    smartReplyServiceMock as unknown as SmartReplyService,
    auditLogRepoMock as unknown as Repository<AuditLog>,
  );
  const originalAutoPurgeEnv =
    process.env.MAILZEN_SMART_REPLY_HISTORY_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLogMock.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
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
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'smart_reply_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'smart_reply_retention_autopurge_completed',
      }),
    );
  });

  it('skips smart reply history purge when disabled by env', async () => {
    process.env.MAILZEN_SMART_REPLY_HISTORY_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeSmartReplyHistory();

    expect(purgeHistoryByRetentionPolicyMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'smart_reply_retention_autopurge_skipped',
      }),
    );
  });

  it('records failed autopurge audit action when retention purge throws', async () => {
    purgeHistoryByRetentionPolicyMock.mockRejectedValue(
      new Error('smart reply retention failed'),
    );

    await scheduler.purgeSmartReplyHistory();

    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'smart_reply_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'smart_reply_retention_autopurge_failed',
        metadata: expect.objectContaining({
          error: 'smart reply retention failed',
        }),
      }),
    );
  });

  it('continues purge flow when scheduler audit writes fail', async () => {
    saveAuditLogMock.mockRejectedValue(new Error('audit datastore unavailable'));
    purgeHistoryByRetentionPolicyMock.mockResolvedValue({
      deletedRows: 3,
      retentionDays: 180,
    });

    await expect(scheduler.purgeSmartReplyHistory()).resolves.toBeUndefined();

    expect(purgeHistoryByRetentionPolicyMock).toHaveBeenCalledWith({});
  });
});
