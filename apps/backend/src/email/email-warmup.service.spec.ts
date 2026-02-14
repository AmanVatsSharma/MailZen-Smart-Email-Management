import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { EmailWarmupService } from './email.email-warmup.service';

describe('EmailWarmupService (smoke)', () => {
  let service: EmailWarmupService;
  let prismaService: any;

  const mockProviderId = 'provider-1';
  const mockUserId = 'user-1';

  const mockWarmup = {
    id: 'warmup-1',
    providerId: mockProviderId,
    status: 'ACTIVE',
    currentDailyLimit: 5,
    dailyIncrement: 5,
    maxDailyEmails: 100,
    minimumInterval: 15,
    targetOpenRate: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      emailProvider: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockProviderId,
          userId: mockUserId,
          warmup: null,
        }),
      },
      emailWarmup: {
        create: jest.fn().mockResolvedValue(mockWarmup),
        update: jest
          .fn()
          .mockResolvedValue({ ...mockWarmup, status: 'PAUSED' }),
        findFirst: jest.fn().mockResolvedValue(mockWarmup),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailWarmupService,
        { provide: PrismaService, useValue: prismaService },
        { provide: EmailService, useValue: { sendEmail: jest.fn() } },
      ],
    }).compile();

    service = module.get(EmailWarmupService);
  });

  afterEach(() => jest.clearAllMocks());

  it('startWarmup creates a new warmup when none exists', async () => {
    const res = await service.startWarmup(
      { providerId: mockProviderId, config: { dailyIncrement: 5 } } as any,
      mockUserId,
    );
    expect(prismaService.emailProvider.findFirst).toHaveBeenCalled();
    expect(prismaService.emailWarmup.create).toHaveBeenCalled();
    expect(res).toEqual(mockWarmup);
  });

  it('pauseWarmup updates warmup status', async () => {
    const res = await service.pauseWarmup(
      { providerId: mockProviderId } as any,
      mockUserId,
    );
    expect(prismaService.emailWarmup.findFirst).toHaveBeenCalled();
    expect(prismaService.emailWarmup.update).toHaveBeenCalled();
    expect(res.status).toBe('PAUSED');
  });

  it('pauseWarmup throws if not found', async () => {
    prismaService.emailWarmup.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.pauseWarmup({ providerId: mockProviderId } as any, mockUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
