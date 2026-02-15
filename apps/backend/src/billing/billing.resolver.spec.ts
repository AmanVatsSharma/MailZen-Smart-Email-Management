import { BillingResolver } from './billing.resolver';

describe('BillingResolver', () => {
  const billingServiceMock = {
    getAiCreditBalance: jest.fn(),
  };

  const resolver = new BillingResolver(billingServiceMock as any);

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
    } as any);

    expect(result.planCode).toBe('PRO');
    expect(billingServiceMock.getAiCreditBalance).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
