import { Test, TestingModule } from '@nestjs/testing';
import { EmailWarmupService } from './email.email-warmup.service';
import { EmailWarmupResolver } from './email.email-warmup.resolver';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

describe('EmailWarmupResolver (smoke)', () => {
  let resolver: EmailWarmupResolver;
  let service: any;

  const mockProviderId = 'provider-1';
  const mockUserId = 'user-1';
  const mockContext = { req: { user: { id: mockUserId } } };

  const mockWarmup = {
    id: 'warmup-1',
    providerId: mockProviderId,
    status: 'ACTIVE',
    currentDailyLimit: 5,
    dailyIncrement: 5,
    maxDailyEmails: 100,
    minimumInterval: 15,
    targetOpenRate: 80,
  };

  const mockEmailWarmupService = {
    startWarmup: jest.fn().mockResolvedValue(mockWarmup),
    pauseWarmup: jest
      .fn()
      .mockResolvedValue({ ...mockWarmup, status: 'PAUSED' }),
    getWarmupStatus: jest.fn().mockResolvedValue(mockWarmup),
    getWarmupPerformanceMetrics: jest.fn().mockResolvedValue({
      averageOpenRate: 0,
      totalEmailsSent: 0,
      daysActive: 0,
      currentPhase: 'Initial',
    }),
    adjustWarmupStrategy: jest.fn().mockResolvedValue(mockWarmup),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailWarmupResolver,
        { provide: EmailWarmupService, useValue: mockEmailWarmupService },
        JwtAuthGuard,
        {
          provide: AuthService,
          useValue: {
            validateToken: jest.fn().mockReturnValue({ id: mockUserId }),
          },
        },
      ],
    }).compile();

    resolver = module.get(EmailWarmupResolver);
    service = module.get(EmailWarmupService);
  });

  afterEach(() => jest.clearAllMocks());

  it('startEmailWarmup passes input + userId', async () => {
    const input = {
      providerId: mockProviderId,
      config: { dailyIncrement: 5 },
    } as any;
    const res = await resolver.startEmailWarmup(input, mockContext as any);
    expect(service.startWarmup).toHaveBeenCalledWith(input, mockUserId);
    expect(res).toEqual(mockWarmup);
  });

  it('pauseEmailWarmup passes input + userId', async () => {
    const input = { providerId: mockProviderId } as any;
    const res = await resolver.pauseEmailWarmup(input, mockContext as any);
    expect(service.pauseWarmup).toHaveBeenCalledWith(input, mockUserId);
    expect(res).not.toBeNull();
    expect(res?.status).toBe('PAUSED');
  });

  it('getEmailWarmupStatus calls service.getWarmupStatus', async () => {
    const res = await resolver.getEmailWarmupStatus(
      mockProviderId,
      mockContext as any,
    );
    expect(service.getWarmupStatus).toHaveBeenCalledWith(
      mockProviderId,
      mockUserId,
    );
    expect(res).toEqual(mockWarmup);
  });
});
