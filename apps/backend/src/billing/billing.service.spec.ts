/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { BillingPlan } from './entities/billing-plan.entity';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { UserAiCreditUsage } from './entities/user-ai-credit-usage.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  let service: BillingService;
  let planRepo: jest.Mocked<Repository<BillingPlan>>;
  let subscriptionRepo: jest.Mocked<Repository<UserSubscription>>;
  let usageRepo: jest.Mocked<Repository<UserAiCreditUsage>>;
  let invoiceRepo: jest.Mocked<Repository<BillingInvoice>>;
  let webhookRepo: jest.Mocked<Repository<BillingWebhookEvent>>;
  let notificationEventBus: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  >;

  beforeEach(() => {
    planRepo = {
      count: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<BillingPlan>>;
    subscriptionRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserSubscription>>;
    const queryBuilderMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    usageRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      upsert: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    } as unknown as jest.Mocked<Repository<UserAiCreditUsage>>;
    invoiceRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((value) => value as BillingInvoice),
      save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    } as unknown as jest.Mocked<Repository<BillingInvoice>>;
    webhookRepo = {
      findOne: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((value) => value as BillingWebhookEvent),
      save: jest
        .fn()
        .mockImplementation((value) => Promise.resolve(value as never)),
    } as unknown as jest.Mocked<Repository<BillingWebhookEvent>>;
    notificationEventBus = {
      publishSafely: jest.fn(),
    };

    service = new BillingService(
      planRepo,
      subscriptionRepo,
      usageRepo,
      invoiceRepo,
      webhookRepo,
      notificationEventBus as unknown as NotificationEventBusService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('seeds default plans when no catalog exists', async () => {
    planRepo.count.mockResolvedValue(0);
    planRepo.create.mockReturnValue([] as unknown as BillingPlan);
    planRepo.save.mockResolvedValue({} as BillingPlan);

    await service.ensureDefaultPlans();

    expect(planRepo.save).toHaveBeenCalled();
  });

  it('returns existing active subscription when present', async () => {
    const existing = {
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'PRO',
      status: 'active',
    } as UserSubscription;
    planRepo.count.mockResolvedValue(1);
    subscriptionRepo.findOne.mockResolvedValue(existing);

    const result = await service.getMySubscription('user-1');

    expect(result).toBe(existing);
  });

  it('creates FREE subscription when user has none', async () => {
    const created = {
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'FREE',
      status: 'active',
    } as UserSubscription;
    planRepo.count.mockResolvedValue(1);
    subscriptionRepo.findOne.mockResolvedValue(null);
    subscriptionRepo.create.mockReturnValue(created);
    subscriptionRepo.save.mockResolvedValue(created);

    const result = await service.getMySubscription('user-1');

    expect(subscriptionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ planCode: 'FREE' }),
    );
    expect(result).toEqual(created);
  });

  it('switches active plan for user', async () => {
    const current = {
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'FREE',
      status: 'active',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      endsAt: null,
    } as UserSubscription;
    planRepo.count.mockResolvedValue(1);
    planRepo.findOne.mockResolvedValue({
      id: 'plan-1',
      code: 'PRO',
      isActive: true,
      priceMonthlyCents: 1900,
      currency: 'USD',
      workspaceLimit: 5,
    } as BillingPlan);
    subscriptionRepo.findOne.mockResolvedValue(current);
    subscriptionRepo.save.mockImplementation((value: UserSubscription) =>
      Promise.resolve(value),
    );

    const result = await service.selectPlan('user-1', 'pro');

    expect(result.planCode).toBe('PRO');
    expect(subscriptionRepo.save).toHaveBeenCalled();
    expect(invoiceRepo.save).toHaveBeenCalled();
  });

  it('records upgrade intent notification', async () => {
    planRepo.count.mockResolvedValue(1);
    planRepo.findOne.mockResolvedValue({
      id: 'plan-1',
      code: 'BUSINESS',
      isActive: true,
      providerLimit: 25,
      mailboxLimit: 25,
      workspaceLimit: 25,
      aiCreditsPerMonth: 5000,
    } as BillingPlan);
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'PRO',
      status: 'active',
    } as UserSubscription);
    notificationEventBus.publishSafely.mockResolvedValue(null);

    const result = await service.requestUpgradeIntent(
      'user-1',
      'business',
      'Need more seats',
    );

    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'BILLING_UPGRADE_INTENT',
      }),
    );
    expect(result.success).toBe(true);
    expect(result.targetPlanCode).toBe('BUSINESS');
  });

  it('returns AI credit balance for current period', async () => {
    planRepo.count.mockResolvedValue(1);
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'PRO',
      status: 'active',
    } as UserSubscription);
    planRepo.findOne.mockResolvedValue({
      id: 'plan-pro',
      code: 'PRO',
      isActive: true,
      providerLimit: 5,
      mailboxLimit: 5,
      workspaceLimit: 5,
      aiCreditsPerMonth: 500,
    } as BillingPlan);
    usageRepo.upsert.mockResolvedValue({} as never);
    usageRepo.findOne.mockResolvedValue({
      id: 'usage-1',
      userId: 'user-1',
      periodStart: '2026-02-01',
      usedCredits: 120,
      lastConsumedAt: new Date('2026-02-15T00:00:00.000Z'),
    } as UserAiCreditUsage);

    const balance = await service.getAiCreditBalance('user-1');

    expect(balance.monthlyLimit).toBe(500);
    expect(balance.usedCredits).toBe(120);
    expect(balance.remainingCredits).toBe(380);
  });

  it('denies AI credit consumption when monthly limit exhausted', async () => {
    const queryBuilder = usageRepo.createQueryBuilder() as unknown as {
      execute: jest.Mock;
    };
    queryBuilder.execute.mockResolvedValue({ affected: 0 });
    planRepo.count.mockResolvedValue(1);
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'FREE',
      status: 'active',
    } as UserSubscription);
    planRepo.findOne.mockResolvedValue({
      id: 'plan-free',
      code: 'FREE',
      isActive: true,
      providerLimit: 1,
      mailboxLimit: 1,
      workspaceLimit: 1,
      aiCreditsPerMonth: 50,
    } as BillingPlan);
    usageRepo.upsert.mockResolvedValue({} as never);
    usageRepo.findOne.mockResolvedValue({
      id: 'usage-1',
      userId: 'user-1',
      periodStart: '2026-02-01',
      usedCredits: 50,
      lastConsumedAt: new Date('2026-02-15T00:00:00.000Z'),
    } as UserAiCreditUsage);

    const result = await service.consumeAiCredits({
      userId: 'user-1',
      credits: 1,
      requestId: 'req-1',
    });

    expect(result.allowed).toBe(false);
    expect(result.remainingCredits).toBe(0);
  });

  it('lists my billing invoices with bounded limit', async () => {
    invoiceRepo.find.mockResolvedValue([
      {
        id: 'inv-1',
        userId: 'user-1',
        status: 'paid',
      } as BillingInvoice,
    ]);

    const result = await service.listMyInvoices('user-1', 999);

    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 100,
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('starts trial on paid plan and emits notification', async () => {
    planRepo.count.mockResolvedValue(1);
    planRepo.findOne.mockResolvedValue({
      id: 'plan-1',
      code: 'PRO',
      isActive: true,
      priceMonthlyCents: 1900,
      currency: 'USD',
    } as BillingPlan);
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'FREE',
      status: 'active',
      isTrial: false,
      trialEndsAt: null,
    } as UserSubscription);
    subscriptionRepo.save.mockImplementation((value: UserSubscription) =>
      Promise.resolve(value),
    );
    notificationEventBus.publishSafely.mockResolvedValue(null);

    const result = await service.startPlanTrial('user-1', 'pro', 10);

    expect(result.planCode).toBe('PRO');
    expect(result.isTrial).toBe(true);
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'BILLING_TRIAL_STARTED',
      }),
    );
  });

  it('ingests paid webhook events and marks them processed', async () => {
    webhookRepo.findOne.mockResolvedValue(null);
    webhookRepo.save
      .mockResolvedValueOnce({
        id: 'evt-1',
        provider: 'STRIPE',
        eventType: 'invoice.paid',
        externalEventId: 'evt_external_1',
        payload: {},
        status: 'received',
      } as BillingWebhookEvent)
      .mockResolvedValueOnce({
        id: 'evt-1',
        provider: 'STRIPE',
        eventType: 'invoice.paid',
        externalEventId: 'evt_external_1',
        payload: {},
        status: 'processed',
      } as BillingWebhookEvent);
    planRepo.count.mockResolvedValue(1);
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'PRO',
      status: 'active',
      startedAt: new Date('2026-02-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      isTrial: false,
      trialEndsAt: null,
      metadata: undefined,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    } as UserSubscription);
    subscriptionRepo.save.mockImplementation((value: UserSubscription) =>
      Promise.resolve(value),
    );

    const result = await service.ingestBillingWebhook({
      provider: 'stripe',
      eventType: 'invoice.paid',
      externalEventId: 'evt_external_1',
      payloadJson: JSON.stringify({
        userId: 'user-1',
        planCode: 'BUSINESS',
        amountCents: 5900,
        currency: 'USD',
      }),
    });

    expect(result.status).toBe('processed');
    expect(invoiceRepo.save).toHaveBeenCalled();
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        planCode: 'BUSINESS',
        isTrial: false,
      }),
    );
  });

  it('returns existing webhook when external event already processed', async () => {
    webhookRepo.findOne.mockResolvedValue({
      id: 'evt-existing',
      provider: 'STRIPE',
      externalEventId: 'evt-existing',
      status: 'processed',
    } as BillingWebhookEvent);

    const result = await service.ingestBillingWebhook({
      provider: 'stripe',
      eventType: 'invoice.paid',
      externalEventId: 'evt-existing',
      payloadJson: '{}',
    });

    expect(result.id).toBe('evt-existing');
    expect(webhookRepo.save).not.toHaveBeenCalled();
  });
});
