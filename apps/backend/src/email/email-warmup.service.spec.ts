import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailService } from './email.service';
import { EmailWarmupService } from './email.email-warmup.service';
import { EmailWarmup } from './entities/email-warmup.entity';
import { WarmupActivity } from './entities/warmup-activity.entity';

describe('EmailWarmupService', () => {
  let service: EmailWarmupService;
  let emailProviderRepo: jest.Mocked<Repository<EmailProvider>>;
  let emailWarmupRepo: jest.Mocked<Repository<EmailWarmup>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  const providerId = 'provider-1';
  const userId = 'user-1';
  const warmup = {
    id: 'warmup-1',
    providerId,
    status: 'ACTIVE',
    currentDailyLimit: 5,
    dailyIncrement: 5,
    maxDailyEmails: 100,
    minimumInterval: 15,
    targetOpenRate: 80,
  } as EmailWarmup;

  beforeEach(async () => {
    const providerRepoMock = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;

    const warmupRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailWarmup>>;

    const activityRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<WarmupActivity>>;
    const auditRepoMock = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailWarmupService,
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn() },
        },
        {
          provide: getRepositoryToken(EmailProvider),
          useValue: providerRepoMock,
        },
        {
          provide: getRepositoryToken(EmailWarmup),
          useValue: warmupRepoMock,
        },
        {
          provide: getRepositoryToken(WarmupActivity),
          useValue: activityRepoMock,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditRepoMock,
        },
      ],
    }).compile();

    service = module.get<EmailWarmupService>(EmailWarmupService);
    emailProviderRepo = module.get(getRepositoryToken(EmailProvider));
    emailWarmupRepo = module.get(getRepositoryToken(EmailWarmup));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('starts a new warmup when provider has no warmup row', async () => {
    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      warmup: null,
    } as any);
    emailWarmupRepo.create.mockReturnValue(warmup);
    emailWarmupRepo.save.mockResolvedValue(warmup);

    const result = await service.startWarmup({ providerId } as any, userId);

    expect(emailProviderRepo.findOne).toHaveBeenCalledWith({
      where: { id: providerId, userId },
      relations: ['warmup'],
    });
    expect(emailWarmupRepo.save).toHaveBeenCalledWith(warmup);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        action: 'email_warmup_started',
      }),
    );
    expect(result).toEqual(warmup);
  });

  it('pauses an existing warmup', async () => {
    const queryBuilderMock = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(warmup),
    };

    emailWarmupRepo.createQueryBuilder.mockReturnValue(queryBuilderMock as any);
    emailWarmupRepo.update.mockResolvedValue({} as any);
    emailWarmupRepo.findOne.mockResolvedValue({
      ...warmup,
      status: 'PAUSED',
    } as any);

    const result = await service.pauseWarmup({ providerId } as any, userId);

    expect(emailWarmupRepo.update).toHaveBeenCalledWith(
      { id: warmup.id },
      { status: 'PAUSED' },
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        action: 'email_warmup_paused',
      }),
    );
    expect(result?.status).toBe('PAUSED');
  });

  it('throws when pauseWarmup does not find a row', async () => {
    const queryBuilderMock = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    emailWarmupRepo.createQueryBuilder.mockReturnValue(queryBuilderMock as any);

    await expect(
      service.pauseWarmup({ providerId } as any, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resumes paused warmup and records audit action', async () => {
    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      warmup: {
        id: warmup.id,
        status: 'PAUSED',
      },
    } as any);
    emailWarmupRepo.update.mockResolvedValue({} as any);
    emailWarmupRepo.findOne.mockResolvedValue({
      ...warmup,
      status: 'ACTIVE',
    } as any);

    const result = await service.startWarmup({ providerId } as any, userId);

    expect(emailWarmupRepo.update).toHaveBeenCalledWith(
      { id: warmup.id },
      { status: 'ACTIVE' },
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        action: 'email_warmup_resumed',
      }),
    );
    expect(result?.status).toBe('ACTIVE');
  });

  it('continues warmup start when audit persistence fails', async () => {
    emailProviderRepo.findOne.mockResolvedValue({
      id: providerId,
      userId,
      warmup: null,
    } as any);
    emailWarmupRepo.create.mockReturnValue(warmup);
    emailWarmupRepo.save.mockResolvedValue(warmup);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.startWarmup({ providerId } as any, userId);

    expect(result).toEqual(warmup);
  });
});
