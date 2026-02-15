/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { BillingPlan } from './entities/billing-plan.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  let service: BillingService;
  let planRepo: jest.Mocked<Repository<BillingPlan>>;
  let subscriptionRepo: jest.Mocked<Repository<UserSubscription>>;

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

    service = new BillingService(planRepo, subscriptionRepo);
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
    } as BillingPlan);
    subscriptionRepo.findOne.mockResolvedValue(current);
    subscriptionRepo.save.mockImplementation((value: UserSubscription) =>
      Promise.resolve(value),
    );

    const result = await service.selectPlan('user-1', 'pro');

    expect(result.planCode).toBe('PRO');
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });
});
