import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { BillingRetentionScheduler } from './billing-retention.scheduler';
import { BillingService } from './billing.service';

describe('BillingRetentionScheduler', () => {
  const schedulerActorUserId = 'system:billing-retention-scheduler';
  const purgeExpiredBillingDataMock = jest.fn();
  const createAuditLogMock = jest.fn();
  const saveAuditLogMock = jest.fn();
  const billingServiceMock = {
    purgeExpiredBillingData: purgeExpiredBillingDataMock,
  };
  const auditLogRepoMock: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>> =
    {
      create: createAuditLogMock,
      save: saveAuditLogMock,
    };
  const scheduler = new BillingRetentionScheduler(
    billingServiceMock as unknown as BillingService,
    auditLogRepoMock as unknown as Repository<AuditLog>,
  );
  const originalAutopurgeEnv = process.env.BILLING_RETENTION_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    createAuditLogMock.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    saveAuditLogMock.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
    delete process.env.BILLING_RETENTION_AUTOPURGE_ENABLED;
  });

  afterAll(() => {
    if (typeof originalAutopurgeEnv === 'string') {
      process.env.BILLING_RETENTION_AUTOPURGE_ENABLED = originalAutopurgeEnv;
      return;
    }
    delete process.env.BILLING_RETENTION_AUTOPURGE_ENABLED;
  });

  it('triggers billing retention purge when enabled', async () => {
    purgeExpiredBillingDataMock.mockResolvedValue({
      webhookEventsDeleted: 3,
      aiUsageRowsDeleted: 2,
      webhookRetentionDays: 120,
      aiUsageRetentionMonths: 36,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await scheduler.purgeExpiredBillingData();

    expect(purgeExpiredBillingDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'billing_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'billing_retention_autopurge_completed',
      }),
    );
  });

  it('skips purge when disabled by env flag', async () => {
    process.env.BILLING_RETENTION_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeExpiredBillingData();

    expect(purgeExpiredBillingDataMock).not.toHaveBeenCalled();
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'billing_retention_autopurge_skipped',
      }),
    );
  });

  it('records failed autopurge audit action when billing purge throws', async () => {
    purgeExpiredBillingDataMock.mockRejectedValue(
      new Error('billing purge failed'),
    );

    await scheduler.purgeExpiredBillingData();

    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'billing_retention_autopurge_started',
      }),
    );
    expect(saveAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: schedulerActorUserId,
        action: 'billing_retention_autopurge_failed',
        metadata: expect.objectContaining({
          error: 'billing purge failed',
        }),
      }),
    );
  });

  it('continues purge flow when scheduler audit writes fail', async () => {
    saveAuditLogMock.mockRejectedValue(new Error('audit datastore unavailable'));
    purgeExpiredBillingDataMock.mockResolvedValue({
      webhookEventsDeleted: 3,
      aiUsageRowsDeleted: 2,
      webhookRetentionDays: 120,
      aiUsageRetentionMonths: 36,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await expect(scheduler.purgeExpiredBillingData()).resolves.toBeUndefined();

    expect(purgeExpiredBillingDataMock).toHaveBeenCalledWith({
      actorUserId: schedulerActorUserId,
    });
  });
});
