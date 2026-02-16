/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailAnalyticsService } from './email-analytics.service';
import { EmailAnalytics as EmailAnalyticsEntity } from './entities/email-analytics.entity';
import { Email } from '../email/entities/email.entity';

describe('EmailAnalyticsService', () => {
  let service: EmailAnalyticsService;
  let analyticsRepo: jest.Mocked<Repository<EmailAnalyticsEntity>>;
  let emailRepo: jest.Mocked<Repository<Email>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(() => {
    analyticsRepo = {
      upsert: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailAnalyticsEntity>>;
    emailRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Email>>;
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;

    service = new EmailAnalyticsService(analyticsRepo, emailRepo, auditLogRepo);
    jest.clearAllMocks();
  });

  it('creates analytics when email is owned by user', async () => {
    emailRepo.findOne.mockResolvedValue({
      id: 'email-1',
      userId: 'user-1',
    } as Email);
    analyticsRepo.findOne.mockResolvedValue({
      id: 'analytics-1',
      emailId: 'email-1',
      openCount: 3,
      clickCount: 1,
      updatedAt: new Date('2026-02-16T00:00:00.000Z'),
    } as EmailAnalyticsEntity);

    const result = await service.createEmailAnalytics('user-1', {
      emailId: 'email-1',
      openCount: 3,
      clickCount: 1,
      lastUpdatedAt: new Date('2026-02-16T00:00:00.000Z'),
    });

    expect(analyticsRepo.upsert).toHaveBeenCalledWith(
      [
        {
          emailId: 'email-1',
          openCount: 3,
          clickCount: 1,
        },
      ],
      ['emailId'],
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'analytics-1',
        emailId: 'email-1',
        openCount: 3,
        clickCount: 1,
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_analytics_upserted',
      }),
    );
  });

  it('throws when email does not belong to user', async () => {
    emailRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createEmailAnalytics('user-1', {
        emailId: 'missing-email',
        openCount: 0,
        clickCount: 0,
        lastUpdatedAt: new Date('2026-02-16T00:00:00.000Z'),
      }),
    ).rejects.toThrow(NotFoundException);
    expect(analyticsRepo.upsert).not.toHaveBeenCalled();
  });

  it('lists analytics scoped to user', async () => {
    const getMany = jest.fn().mockResolvedValue([
      {
        id: 'analytics-1',
        emailId: 'email-1',
        openCount: 2,
        clickCount: 1,
        updatedAt: new Date('2026-02-16T00:00:00.000Z'),
      },
    ]);
    const orderBy = jest.fn().mockReturnValue({ getMany });
    const where = jest.fn().mockReturnValue({ orderBy });
    const innerJoin = jest.fn().mockReturnValue({ where });
    analyticsRepo.createQueryBuilder.mockReturnValue({
      innerJoin,
    } as never);

    const result = await service.getAllEmailAnalytics('user-1');

    expect(analyticsRepo.createQueryBuilder).toHaveBeenCalledWith('a');
    expect(innerJoin).toHaveBeenCalledWith('a.email', 'e');
    expect(where).toHaveBeenCalledWith('e.userId = :userId', {
      userId: 'user-1',
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'analytics-1',
        emailId: 'email-1',
        openCount: 2,
        clickCount: 1,
      }),
    ]);
  });

  it('continues analytics upsert when audit write fails', async () => {
    emailRepo.findOne.mockResolvedValue({
      id: 'email-2',
      userId: 'user-1',
    } as Email);
    analyticsRepo.findOne.mockResolvedValue({
      id: 'analytics-2',
      emailId: 'email-2',
      openCount: 4,
      clickCount: 2,
      updatedAt: new Date('2026-02-16T01:00:00.000Z'),
    } as EmailAnalyticsEntity);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.createEmailAnalytics('user-1', {
      emailId: 'email-2',
      openCount: 4,
      clickCount: 2,
      lastUpdatedAt: new Date('2026-02-16T01:00:00.000Z'),
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'analytics-2',
        emailId: 'email-2',
      }),
    );
  });
});
