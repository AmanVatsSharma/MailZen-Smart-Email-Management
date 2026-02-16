import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProviderService } from '../email-integration/email-provider.service';
import { Email } from './entities/email.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailAnalytics } from '../email-analytics/entities/email-analytics.entity';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let emailRepo: jest.Mocked<Repository<Email>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(() => {
    emailRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Email>>;
    const providerRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    const analyticsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailAnalytics>>;
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;

    service = new EmailService(
      emailRepo,
      providerRepo,
      analyticsRepo,
      auditLogRepo,
      {} as EmailProviderService,
      {} as MailerService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('marks owned email as read and records audit action', async () => {
    emailRepo.findOne
      .mockResolvedValueOnce({
        id: 'email-1',
        userId: 'user-1',
        status: 'SENT',
      } as Email)
      .mockResolvedValueOnce({
        id: 'email-1',
        userId: 'user-1',
        status: 'READ',
      } as Email);
    emailRepo.update.mockResolvedValue({} as never);

    const result = await service.markEmailRead('email-1', 'user-1');

    expect(emailRepo.update).toHaveBeenCalledWith(
      { id: 'email-1', userId: 'user-1' },
      { status: 'READ' },
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_marked_read',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'email-1',
        status: 'READ',
      }),
    );
  });

  it('throws not found when email is not owned by user', async () => {
    emailRepo.findOne.mockResolvedValue(null);

    await expect(service.markEmailRead('email-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(emailRepo.update).not.toHaveBeenCalled();
  });

  it('continues mark-read flow when audit persistence fails', async () => {
    emailRepo.findOne
      .mockResolvedValueOnce({
        id: 'email-2',
        userId: 'user-1',
        status: 'SENT',
      } as Email)
      .mockResolvedValueOnce({
        id: 'email-2',
        userId: 'user-1',
        status: 'READ',
      } as Email);
    emailRepo.update.mockResolvedValue({} as never);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.markEmailRead('email-2', 'user-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'email-2',
        status: 'READ',
      }),
    );
  });
});
