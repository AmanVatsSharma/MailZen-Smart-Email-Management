import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { MailboxService } from './mailbox.service';
import { MailboxInboundRetentionScheduler } from './mailbox-inbound-retention.scheduler';

describe('MailboxInboundRetentionScheduler', () => {
  const schedulerActorUserId = 'system:mailbox-inbound-retention-scheduler';
  const purgeInboundEventRetentionDataMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();
  const mailboxServiceMock: jest.Mocked<
    Pick<MailboxService, 'purgeInboundEventRetentionData'>
  > = {
    purgeInboundEventRetentionData: purgeInboundEventRetentionDataMock,
  };
  const auditLogRepoMock: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>> =
    {
      create: createAuditLogMock,
      save: saveAuditLogMock,
    };
  const scheduler = new MailboxInboundRetentionScheduler(
    mailboxServiceMock as unknown as MailboxService,
    auditLogRepoMock as unknown as Repository<AuditLog>,
  );
  const originalAutoPurgeEnv =
    process.env.MAILZEN_MAILBOX_INBOUND_RETENTION_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLogMock.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
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

    expect(purgeInboundEventRetentionDataMock).toHaveBeenCalledWith({
      userId: schedulerActorUserId,
    });
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_inbound_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_inbound_retention_autopurge_completed',
      }),
    );
  });

  it('skips inbound purge when auto-purge disabled', async () => {
    process.env.MAILZEN_MAILBOX_INBOUND_RETENTION_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeMailboxInboundRetentionData();

    expect(purgeInboundEventRetentionDataMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_inbound_retention_autopurge_skipped',
      }),
    );
  });

  it('records failed autopurge audit action when inbound purge throws', async () => {
    purgeInboundEventRetentionDataMock.mockRejectedValue(
      new Error('inbound purge failed'),
    );

    await scheduler.purgeMailboxInboundRetentionData();

    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_inbound_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'mailbox_inbound_retention_autopurge_failed',
        metadata: expect.objectContaining({
          error: 'inbound purge failed',
        }),
      }),
    );
  });

  it('continues purge flow when scheduler audit writes fail', async () => {
    saveAuditLogMock.mockRejectedValue(new Error('audit datastore unavailable'));
    purgeInboundEventRetentionDataMock.mockResolvedValue({
      deletedEvents: 9,
      retentionDays: 180,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await expect(
      scheduler.purgeMailboxInboundRetentionData(),
    ).resolves.toBeUndefined();

    expect(purgeInboundEventRetentionDataMock).toHaveBeenCalledWith({
      userId: schedulerActorUserId,
    });
  });
});
