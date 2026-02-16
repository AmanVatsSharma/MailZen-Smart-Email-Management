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
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let analyticsRepo: jest.Mocked<Repository<EmailAnalytics>>;
  let mailerService: jest.Mocked<MailerService>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(() => {
    emailRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Email>>;
    providerRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    analyticsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailAnalytics>>;
    mailerService = {
      sendMail: jest.fn(),
    } as unknown as jest.Mocked<MailerService>;
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
      mailerService,
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

  it('records audit actions for scheduled sends', async () => {
    const scheduledAt = new Date('2026-02-16T18:00:00.000Z');
    emailRepo.create.mockReturnValue({
      id: 'email-3',
      userId: 'user-1',
      status: 'SCHEDULED',
      scheduledAt,
    } as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-3',
      userId: 'user-1',
      status: 'SCHEDULED',
      scheduledAt,
    } as Email);
    analyticsRepo.create.mockReturnValue({
      id: 'analytics-1',
      emailId: 'email-3',
      openCount: 0,
      clickCount: 0,
    } as EmailAnalytics);
    analyticsRepo.save.mockResolvedValue({} as EmailAnalytics);

    const result = await service.sendEmail(
      {
        subject: 'Scheduled',
        body: 'Body',
        from: 'sender@mailzen.com',
        to: ['one@mailzen.com'],
        providerId: 'provider-1',
        scheduledAt,
      },
      'user-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'email-3',
        status: 'SCHEDULED',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_send_requested',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_send_scheduled',
      }),
    );
  });

  it('records audit failure action when provider is missing on send', async () => {
    emailRepo.create.mockReturnValue({
      id: 'email-4',
      userId: 'user-1',
      status: 'PENDING',
    } as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-4',
      userId: 'user-1',
      status: 'PENDING',
    } as Email);
    analyticsRepo.create.mockReturnValue({
      id: 'analytics-2',
      emailId: 'email-4',
      openCount: 0,
      clickCount: 0,
    } as EmailAnalytics);
    analyticsRepo.save.mockResolvedValue({} as EmailAnalytics);
    providerRepo.findOne.mockResolvedValue(null);

    await expect(
      service.sendEmail(
        {
          subject: 'Immediate',
          body: 'Body',
          from: 'sender@mailzen.com',
          to: ['one@mailzen.com'],
          providerId: 'missing-provider',
        },
        'user-1',
      ),
    ).rejects.toThrow('Email provider not found');

    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_send_failed',
      }),
    );
  });

  it('records audit action when sending template email', async () => {
    mailerService.sendMail.mockResolvedValue({
      html: '<p>Hello</p>',
      from: 'sender@mailzen.com',
    } as never);
    emailRepo.create.mockReturnValue({
      id: 'email-5',
      userId: 'user-1',
      status: 'SENT',
    } as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-5',
      userId: 'user-1',
      status: 'SENT',
    } as Email);

    const result = await service.sendTemplateEmail(
      'welcome',
      ['one@mailzen.com'],
      { subject: 'Welcome', name: 'User' },
      'user-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'email-5',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_template_sent',
      }),
    );
  });

  it('records template send failure audit action and rethrows', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('mailer unavailable'));

    await expect(
      service.sendTemplateEmail(
        'welcome',
        ['one@mailzen.com'],
        { subject: 'Welcome', name: 'User' },
        'user-1',
      ),
    ).rejects.toThrow('mailer unavailable');

    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_template_send_failed',
      }),
    );
  });
});
