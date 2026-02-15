import { BillingRetentionScheduler } from './billing-retention.scheduler';
import { BillingService } from './billing.service';

describe('BillingRetentionScheduler', () => {
  const purgeExpiredBillingDataMock = jest.fn();
  const billingServiceMock = {
    purgeExpiredBillingData: purgeExpiredBillingDataMock,
  };
  const scheduler = new BillingRetentionScheduler(
    billingServiceMock as unknown as BillingService,
  );
  const originalAutopurgeEnv = process.env.BILLING_RETENTION_AUTOPURGE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(purgeExpiredBillingDataMock).toHaveBeenCalledWith({});
  });

  it('skips purge when disabled by env flag', async () => {
    process.env.BILLING_RETENTION_AUTOPURGE_ENABLED = 'false';

    await scheduler.purgeExpiredBillingData();

    expect(purgeExpiredBillingDataMock).not.toHaveBeenCalled();
  });
});
