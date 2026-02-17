import { BillingResolver } from './billing.resolver';
import { BillingService } from './billing.service';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { UserSubscription } from './entities/user-subscription.entity';

describe('BillingResolver', () => {
  const billingServiceMock: jest.Mocked<
    Pick<
      BillingService,
      | 'getAiCreditBalance'
      | 'getEntitlementUsageSummary'
      | 'exportMyBillingData'
      | 'exportBillingDataForAdmin'
      | 'listMyInvoices'
      | 'purgeExpiredBillingData'
      | 'startPlanTrial'
      | 'ingestBillingWebhook'
    >
  > = {
    getAiCreditBalance: jest.fn(),
    getEntitlementUsageSummary: jest.fn(),
    exportMyBillingData: jest.fn(),
    exportBillingDataForAdmin: jest.fn(),
    listMyInvoices: jest.fn(),
    purgeExpiredBillingData: jest.fn(),
    startPlanTrial: jest.fn(),
    ingestBillingWebhook: jest.fn(),
  };

  const resolver = new BillingResolver(
    billingServiceMock as unknown as BillingService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates myAiCreditBalance to billing service', async () => {
    billingServiceMock.getAiCreditBalance.mockResolvedValue({
      planCode: 'PRO',
      monthlyLimit: 500,
      usedCredits: 120,
      remainingCredits: 380,
      periodStart: '2026-02-01',
      lastConsumedAtIso: '2026-02-15T00:00:00.000Z',
    });

    const result = await resolver.myAiCreditBalance({
      req: { user: { id: 'user-1' } },
    });

    expect(result.planCode).toBe('PRO');
    expect(billingServiceMock.getAiCreditBalance).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('delegates myBillingInvoices to billing service', async () => {
    billingServiceMock.listMyInvoices.mockResolvedValue([
      {
        id: 'inv-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
        planCode: 'PRO',
        invoiceNumber: 'MZ-202602-000001',
        provider: 'INTERNAL',
        providerInvoiceId: null,
        status: 'open',
        amountCents: 1900,
        currency: 'USD',
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-03-01T00:00:00.000Z'),
        dueAt: null,
        paidAt: null,
        metadata: null,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      } as BillingInvoice,
    ]);

    const result = await resolver.myBillingInvoices(25, {
      req: { user: { id: 'user-1' } },
    });

    expect(result).toHaveLength(1);
    expect(billingServiceMock.listMyInvoices).toHaveBeenCalledWith(
      'user-1',
      25,
    );
  });

  it('delegates myBillingDataExport to billing service', async () => {
    billingServiceMock.exportMyBillingData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"subscription":{"planCode":"PRO"}}',
    });

    const result = await resolver.myBillingDataExport({
      req: { user: { id: 'user-1' } },
    });

    expect(result.generatedAtIso).toBe('2026-02-16T00:00:00.000Z');
    expect(billingServiceMock.exportMyBillingData).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('delegates userBillingDataExport to billing service admin export method', async () => {
    billingServiceMock.exportBillingDataForAdmin.mockResolvedValue({
      generatedAtIso: '2026-02-16T01:00:00.000Z',
      dataJson: '{"subscription":{"planCode":"PRO"}}',
    });

    const result = await resolver.userBillingDataExport('user-2', {
      req: { user: { id: 'admin-1' } },
    });

    expect(result.generatedAtIso).toBe('2026-02-16T01:00:00.000Z');
    expect(billingServiceMock.exportBillingDataForAdmin).toHaveBeenCalledWith({
      targetUserId: 'user-2',
      actorUserId: 'admin-1',
    });
  });

  it('delegates myEntitlementUsage to billing service', async () => {
    billingServiceMock.getEntitlementUsageSummary.mockResolvedValue({
      planCode: 'PRO',
      providerLimit: 5,
      providerUsed: 2,
      providerRemaining: 3,
      mailboxLimit: 5,
      mailboxUsed: 1,
      mailboxRemaining: 4,
      workspaceLimit: 5,
      workspaceUsed: 2,
      workspaceRemaining: 3,
      workspaceMemberLimit: 25,
      workspaceMemberUsed: 7,
      workspaceMemberRemaining: 18,
      workspaceMemberWorkspaceId: 'workspace-1',
      mailboxStorageLimitMb: 10240,
      mailboxesOverEntitledStorageLimit: 0,
      aiCreditsPerMonth: 500,
      aiCreditsUsed: 80,
      aiCreditsRemaining: 420,
      periodStart: '2026-02-01',
      evaluatedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.myEntitlementUsage('workspace-1', {
      req: { user: { id: 'user-1' } },
    });

    expect(result.planCode).toBe('PRO');
    expect(billingServiceMock.getEntitlementUsageSummary).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('delegates startMyPlanTrial to billing service', async () => {
    billingServiceMock.startPlanTrial.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'PRO',
      status: 'active',
      startedAt: new Date('2026-02-01T00:00:00.000Z'),
      endsAt: null,
      isTrial: true,
      trialEndsAt: new Date('2026-02-15T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      billingProviderCustomerId: null,
      metadata: undefined,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    } as UserSubscription);

    const result = await resolver.startMyPlanTrial('pro', 14, {
      req: { user: { id: 'user-1' } },
    });

    expect(result.planCode).toBe('PRO');
    expect(billingServiceMock.startPlanTrial).toHaveBeenCalledWith(
      'user-1',
      'pro',
      14,
    );
  });

  it('delegates ingestBillingWebhook to billing service', async () => {
    billingServiceMock.ingestBillingWebhook.mockResolvedValue({
      id: 'evt-1',
      provider: 'STRIPE',
      eventType: 'invoice.paid',
      externalEventId: 'evt_1',
      status: 'processed',
      processedAt: new Date('2026-02-01T00:00:00.000Z'),
      errorMessage: null,
      payload: {},
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    } as BillingWebhookEvent);

    const result = await resolver.ingestBillingWebhook(
      'stripe',
      'invoice.paid',
      'evt_1',
      '{"userId":"user-1"}',
    );

    expect(result.id).toBe('evt-1');
    expect(billingServiceMock.ingestBillingWebhook).toHaveBeenCalledWith({
      provider: 'stripe',
      eventType: 'invoice.paid',
      externalEventId: 'evt_1',
      payloadJson: '{"userId":"user-1"}',
    });
  });

  it('delegates purgeBillingRetentionData to billing service', async () => {
    billingServiceMock.purgeExpiredBillingData.mockResolvedValue({
      webhookEventsDeleted: 12,
      aiUsageRowsDeleted: 4,
      webhookRetentionDays: 120,
      aiUsageRetentionMonths: 36,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.purgeBillingRetentionData(
      180,
      24,
      {
        req: { user: { id: 'user-1' } },
      },
    );

    expect(result.webhookEventsDeleted).toBe(12);
    expect(billingServiceMock.purgeExpiredBillingData).toHaveBeenCalledWith({
      webhookRetentionDays: 180,
      aiUsageRetentionMonths: 24,
      actorUserId: 'user-1',
    });
  });
});
