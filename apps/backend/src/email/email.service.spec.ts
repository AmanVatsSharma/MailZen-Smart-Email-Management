/**
 * File:        apps/backend/src/email/email.service.spec.ts
 * Module:      Email · Core Service · Tests
 * Purpose:     Unit tests for EmailService covering send, scheduled send, read
 *              marking, audit logging, template sends, inline attachment upload,
 *              and unsubscribeFromSender (sender suppression + email archival).
 *
 * Exports:
 *   - none (Jest test suite)
 *
 * Depends on:
 *   - ./email.service              — unit under test
 *   - ./email.attachment.service   — mocked to verify inline attachment upload calls
 *   - ./entities/suppressed-sender.entity  — mocked repo for suppression tests
 *
 * Side-effects:
 *   - none (all repos / services are mocked)
 *
 * Key invariants:
 *   - AttachmentService.uploadAttachment is mocked; GCS calls are never made in tests
 *   - Constructor arg order must match EmailService's DI order exactly (8 args)
 *
 * Read order:
 *   1. beforeEach  — mock setup and service instantiation
 *   2. test cases  — ordered by feature area (mark-read → send → attachments → unsubscribe)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProviderService } from '../email-integration/email-provider.service';
import { Email } from './entities/email.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailAnalytics } from '../email-analytics/entities/email-analytics.entity';
import { SuppressedSender } from './entities/suppressed-sender.entity';
import { EmailService } from './email.service';
import { AttachmentService } from './email.attachment.service';

describe('EmailService', () => {
  let service: EmailService;
  let emailRepo: jest.Mocked<Repository<Email>>;
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let analyticsRepo: jest.Mocked<Repository<EmailAnalytics>>;
  let mailerService: jest.Mocked<MailerService>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  let attachmentService: jest.Mocked<Pick<AttachmentService, 'uploadAttachment'>>;
  let suppressedSenderRepo: jest.Mocked<Repository<SuppressedSender>>;

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
    attachmentService = {
      uploadAttachment: jest.fn().mockResolvedValue({}),
    };
    suppressedSenderRepo = {
      create: jest.fn((payload: unknown) => payload as SuppressedSender),
      save: jest.fn().mockResolvedValue({} as SuppressedSender),
    } as unknown as jest.Mocked<Repository<SuppressedSender>>;

    service = new EmailService(
      emailRepo,
      providerRepo,
      analyticsRepo,
      auditLogRepo,
      {} as EmailProviderService,
      mailerService,
      attachmentService as unknown as AttachmentService,
      suppressedSenderRepo,
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

  it('uploads inline attachments after email record is saved', async () => {
    const scheduledAt = new Date('2026-06-01T10:00:00.000Z');
    emailRepo.create.mockReturnValue({
      id: 'email-6',
      userId: 'user-1',
      status: 'SCHEDULED',
      scheduledAt,
    } as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-6',
      userId: 'user-1',
      status: 'SCHEDULED',
      scheduledAt,
    } as Email);
    analyticsRepo.create.mockReturnValue({
      id: 'analytics-3',
      emailId: 'email-6',
      openCount: 0,
      clickCount: 0,
    } as EmailAnalytics);
    analyticsRepo.save.mockResolvedValue({} as EmailAnalytics);

    const attachment = {
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      content: 'AAAA',
      size: 100,
    };

    await service.sendEmail(
      {
        subject: 'With attachment',
        body: 'Body',
        from: 'sender@mailzen.com',
        to: ['one@mailzen.com'],
        providerId: 'provider-1',
        scheduledAt,
        attachments: [attachment],
      },
      'user-1',
    );

    expect(attachmentService.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(attachmentService.uploadAttachment).toHaveBeenCalledWith(
      { emailId: 'email-6', attachment },
      'user-1',
    );
  });

  it('does not abort send when attachment upload fails', async () => {
    const scheduledAt = new Date('2026-06-01T10:00:00.000Z');
    emailRepo.create.mockReturnValue({
      id: 'email-7',
      userId: 'user-1',
      status: 'SCHEDULED',
      scheduledAt,
    } as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-7',
      userId: 'user-1',
      status: 'SCHEDULED',
      scheduledAt,
    } as Email);
    analyticsRepo.create.mockReturnValue({
      id: 'analytics-4',
      emailId: 'email-7',
      openCount: 0,
      clickCount: 0,
    } as EmailAnalytics);
    analyticsRepo.save.mockResolvedValue({} as EmailAnalytics);
    attachmentService.uploadAttachment.mockRejectedValueOnce(
      new Error('GCS unavailable'),
    );

    const result = await service.sendEmail(
      {
        subject: 'With failing attachment',
        body: 'Body',
        from: 'sender@mailzen.com',
        to: ['one@mailzen.com'],
        providerId: 'provider-1',
        scheduledAt,
        attachments: [
          {
            filename: 'doc.pdf',
            contentType: 'application/pdf',
            content: 'AAAA',
            size: 100,
          },
        ],
      },
      'user-1',
    );

    // Send completes successfully despite attachment failure
    expect(result).toEqual(
      expect.objectContaining({ id: 'email-7', status: 'SCHEDULED' }),
    );
  });

  it('skips attachment upload when no attachments provided', async () => {
    const scheduledAt = new Date('2026-06-01T10:00:00.000Z');
    emailRepo.create.mockReturnValue({
      id: 'email-8',
      userId: 'user-1',
      status: 'SCHEDULED',
      scheduledAt,
    } as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-8',
      userId: 'user-1',
      status: 'SCHEDULED',
      scheduledAt,
    } as Email);
    analyticsRepo.create.mockReturnValue({} as EmailAnalytics);
    analyticsRepo.save.mockResolvedValue({} as EmailAnalytics);

    await service.sendEmail(
      {
        subject: 'No attachments',
        body: 'Body',
        from: 'sender@mailzen.com',
        to: ['one@mailzen.com'],
        providerId: 'provider-1',
        scheduledAt,
      },
      'user-1',
    );

    expect(attachmentService.uploadAttachment).not.toHaveBeenCalled();
  });

  // ─── unsubscribeFromSender ───────────────────────────────────────────────────

  it('archives the email and suppresses the sender on unsubscribe', async () => {
    emailRepo.findOne.mockResolvedValue({
      id: 'email-9',
      userId: 'user-1',
      from: 'newsletter@example.com',
      status: 'READ',
    } as Email);
    emailRepo.update.mockResolvedValue({} as never);

    const result = await service.unsubscribeFromSender('email-9', 'user-1');

    expect(emailRepo.update).toHaveBeenCalledWith(
      { id: 'email-9', userId: 'user-1' },
      { status: 'ARCHIVED' },
    );
    expect(suppressedSenderRepo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      senderEmail: 'newsletter@example.com',
    });
    expect(suppressedSenderRepo.save).toHaveBeenCalled();
    expect(result).toEqual({ success: true, senderEmail: 'newsletter@example.com' });
  });

  it('records an audit log entry on successful unsubscribe', async () => {
    emailRepo.findOne.mockResolvedValue({
      id: 'email-10',
      userId: 'user-1',
      from: 'promo@shop.com',
      status: 'READ',
    } as Email);
    emailRepo.update.mockResolvedValue({} as never);

    await service.unsubscribeFromSender('email-10', 'user-1');

    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_sender_unsubscribed',
      }),
    );
  });

  it('throws NotFoundException when email not found for unsubscribe', async () => {
    emailRepo.findOne.mockResolvedValue(null);

    await expect(
      service.unsubscribeFromSender('missing-email', 'user-1'),
    ).rejects.toThrow(NotFoundException);

    expect(emailRepo.update).not.toHaveBeenCalled();
    expect(suppressedSenderRepo.save).not.toHaveBeenCalled();
  });

  it('treats duplicate suppression as idempotent success', async () => {
    emailRepo.findOne.mockResolvedValue({
      id: 'email-11',
      userId: 'user-1',
      from: 'dup@example.com',
      status: 'READ',
    } as Email);
    emailRepo.update.mockResolvedValue({} as never);
    suppressedSenderRepo.save.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint'),
    );

    const result = await service.unsubscribeFromSender('email-11', 'user-1');

    expect(result).toEqual({ success: true, senderEmail: 'dup@example.com' });
  });

  it('rethrows non-unique errors from suppressedSender save', async () => {
    emailRepo.findOne.mockResolvedValue({
      id: 'email-12',
      userId: 'user-1',
      from: 'bad@example.com',
      status: 'READ',
    } as Email);
    emailRepo.update.mockResolvedValue({} as never);
    suppressedSenderRepo.save.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(
      service.unsubscribeFromSender('email-12', 'user-1'),
    ).rejects.toThrow('DB connection lost');
  });
});
