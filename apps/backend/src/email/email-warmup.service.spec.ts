import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { EmailWarmupService } from './email.email-warmup.service';

describe('EmailWarmupService', () => {
  let service: EmailWarmupService;
  let prismaService: PrismaService;
  let emailService: EmailService;
  let schedulerRegistry: SchedulerRegistry;

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

  const mockEmailProvider = {
    id: mockProviderId,
    userId: mockUserId,
    name: 'Gmail Account',
    type: 'GMAIL',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock services
  const mockPrismaService = {
    emailWarmupConfig: {
      findFirst: jest.fn().mockResolvedValue(mockWarmupConfig),
      create: jest.fn().mockResolvedValue(mockWarmupConfig),
      update: jest.fn().mockResolvedValue({ ...mockWarmupConfig, status: 'PAUSED' }),
    },
    emailWarmupStats: {
      create: jest.fn().mockResolvedValue(mockWarmupStats),
      findMany: jest.fn().mockResolvedValue([mockWarmupStats]),
    },
    emailProvider: {
      findFirst: jest.fn().mockResolvedValue(mockEmailProvider),
    },
  };

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
  };

  const mockSchedulerRegistry = {
    addCronJob: jest.fn(),
    deleteCronJob: jest.fn(),
    getCronJob: jest.fn().mockReturnValue({
      stop: jest.fn(),
    }),
    has: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailWarmupService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
        { provide: Logger, useValue: { log: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    service = module.get<EmailWarmupService>(EmailWarmupService);
    prismaService = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startWarmup', () => {
    it('should start email warmup for a provider', async () => {
      // Arrange
      const startWarmupInput = {
        providerId: mockProviderId,
        dailyIncrement: 5,
        startVolume: 10,
        maxVolume: 100,
      };

      // Act
      const result = await service.startWarmup(mockUserId, startWarmupInput);

      // Assert
      expect(prismaService.emailProvider.findFirst).toHaveBeenCalledWith({
        where: { id: mockProviderId, userId: mockUserId },
      });
      expect(prismaService.emailWarmupConfig.findFirst).toHaveBeenCalledWith({
        where: { providerId: mockProviderId, userId: mockUserId },
      });
      expect(prismaService.emailWarmupConfig.create).toHaveBeenCalledWith({
        data: {
          providerId: mockProviderId,
          userId: mockUserId,
          status: 'ACTIVE',
          dailyIncrement: startWarmupInput.dailyIncrement,
          startVolume: startWarmupInput.startVolume,
          maxVolume: startWarmupInput.maxVolume,
          currentVolume: startWarmupInput.startVolume,
        },
      });
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      expect(result).toEqual(mockWarmupConfig);
    });

    it('should resume existing warmup if found and currently paused', async () => {
      // Arrange
      const startWarmupInput = {
        providerId: mockProviderId,
        dailyIncrement: 5,
        startVolume: 10,
        maxVolume: 100,
      };

      // Mock to return a PAUSED config
      jest.spyOn(prismaService.emailWarmupConfig, 'findFirst').mockResolvedValueOnce({
        ...mockWarmupConfig,
        status: 'PAUSED',
      });

      // Act
      const result = await service.startWarmup(mockUserId, startWarmupInput);

      // Assert
      expect(prismaService.emailWarmupConfig.update).toHaveBeenCalledWith({
        where: { id: mockWarmupConfig.id },
        data: { status: 'ACTIVE' },
      });
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      expect(result).toEqual({ ...mockWarmupConfig, status: 'PAUSED' });
    });
  });

  describe('pauseWarmup', () => {
    it('should pause a running warmup', async () => {
      // Arrange
      const pauseWarmupInput = {
        providerId: mockProviderId,
      };

      // Act
      const result = await service.pauseWarmup(mockUserId, pauseWarmupInput);

      // Assert
      expect(prismaService.emailWarmupConfig.findFirst).toHaveBeenCalledWith({
        where: { providerId: mockProviderId, userId: mockUserId },
      });
      expect(prismaService.emailWarmupConfig.update).toHaveBeenCalledWith({
        where: { id: mockWarmupConfig.id },
        data: { status: 'PAUSED' },
      });
      expect(result).toEqual({ ...mockWarmupConfig, status: 'PAUSED' });
    });

    it('should throw an error if warmup config not found', async () => {
      // Arrange
      const pauseWarmupInput = {
        providerId: 'non-existent-provider',
      };

      // Mock to return null for non-existent config
      jest.spyOn(prismaService.emailWarmupConfig, 'findFirst').mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.pauseWarmup(mockUserId, pauseWarmupInput)).rejects.toThrow(
        'Warmup configuration not found'
      );
    });
  });

  describe('getWarmupStatus', () => {
    it('should return warmup status and stats', async () => {
      // Act
      const result = await service.getWarmupStatus(mockUserId, mockProviderId);

      // Assert
      expect(prismaService.emailWarmupConfig.findFirst).toHaveBeenCalledWith({
        where: { providerId: mockProviderId, userId: mockUserId },
      });
      expect(prismaService.emailWarmupStats.findMany).toHaveBeenCalledWith({
        where: { warmupConfigId: mockWarmupConfig.id },
        orderBy: { date: 'desc' },
        take: 30,
      });
      expect(result).toEqual({
        config: mockWarmupConfig,
        stats: [mockWarmupStats],
      });
    });

    it('should throw an error if warmup config not found', async () => {
      // Mock to return null for non-existent config
      jest.spyOn(prismaService.emailWarmupConfig, 'findFirst').mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.getWarmupStatus(mockUserId, 'non-existent-provider')).rejects.toThrow(
        'Warmup configuration not found'
      );
    });
  });
}); 