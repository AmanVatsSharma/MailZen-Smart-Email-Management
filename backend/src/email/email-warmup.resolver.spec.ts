import { Test, TestingModule } from '@nestjs/testing';
import { EmailWarmupService } from './email.email-warmup.service';
import { EmailWarmupResolver } from './email.email-warmup.resolver';

describe('EmailWarmupResolver', () => {
  let resolver: EmailWarmupResolver;
  let service: EmailWarmupService;

  // Mock data
  const mockProviderId = 'provider-1';
  const mockUserId = 'user-1';
  
  const mockWarmupConfig = {
    id: 'warmup-1',
    providerId: mockProviderId,
    userId: mockUserId,
    status: 'ACTIVE',
    dailyIncrement: 5,
    startVolume: 10,
    maxVolume: 100,
    currentVolume: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWarmupStats = {
    id: 'stats-1',
    warmupConfigId: 'warmup-1',
    sentCount: 15,
    deliveredCount: 14,
    openedCount: 10,
    repliedCount: 5,
    bounceCount: 1,
    spamCount: 0,
    date: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock context with user info
  const mockContext = {
    req: {
      user: {
        id: mockUserId,
      },
    },
  };

  // Mock EmailWarmupService
  const mockEmailWarmupService = {
    startWarmup: jest.fn().mockResolvedValue(mockWarmupConfig),
    pauseWarmup: jest.fn().mockResolvedValue({ 
      ...mockWarmupConfig,
      status: 'PAUSED',
    }),
    getWarmupStatus: jest.fn().mockResolvedValue({
      config: mockWarmupConfig,
      stats: [mockWarmupStats],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailWarmupResolver,
        { provide: EmailWarmupService, useValue: mockEmailWarmupService },
      ],
    }).compile();

    resolver = module.get<EmailWarmupResolver>(EmailWarmupResolver);
    service = module.get<EmailWarmupService>(EmailWarmupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('startEmailWarmup', () => {
    it('should start email warmup for a provider', async () => {
      // Arrange
      const startWarmupInput = {
        providerId: mockProviderId,
        dailyIncrement: 5,
        startVolume: 10,
        maxVolume: 100,
      };

      // Act
      const result = await resolver.startEmailWarmup(startWarmupInput, mockContext);

      // Assert
      expect(service.startWarmup).toHaveBeenCalledWith(
        mockContext.req.user.id,
        startWarmupInput
      );
      expect(result).toEqual(mockWarmupConfig);
    });
  });

  describe('pauseEmailWarmup', () => {
    it('should pause a running warmup', async () => {
      // Arrange
      const pauseWarmupInput = {
        providerId: mockProviderId,
      };

      // Act
      const result = await resolver.pauseEmailWarmup(pauseWarmupInput, mockContext);

      // Assert
      expect(service.pauseWarmup).toHaveBeenCalledWith(
        mockContext.req.user.id,
        pauseWarmupInput
      );
      expect(result).toEqual({
        ...mockWarmupConfig,
        status: 'PAUSED',
      });
    });
  });

  describe('getEmailWarmupStatus', () => {
    it('should return warmup status and stats', async () => {
      // Act
      const result = await resolver.getEmailWarmupStatus(mockProviderId, mockContext);

      // Assert
      expect(service.getWarmupStatus).toHaveBeenCalledWith(
        mockContext.req.user.id,
        mockProviderId
      );
      expect(result).toEqual({
        config: mockWarmupConfig,
        stats: [mockWarmupStats],
      });
    });
  });
}); 