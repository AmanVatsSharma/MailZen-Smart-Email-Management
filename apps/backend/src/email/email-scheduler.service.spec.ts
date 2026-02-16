import { Repository } from 'typeorm';
import { Job, Queue } from 'bull';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailService } from './email.service';
import { EmailSchedulerService } from './email.email-scheduler.service';

describe('EmailSchedulerService', () => {
  let service: EmailSchedulerService;
  let emailQueue: jest.Mocked<Queue>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  let emailService: jest.Mocked<Pick<EmailService, 'sendEmail'>>;

  beforeEach(() => {
    emailQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJob: jest.fn(),
    } as unknown as jest.Mocked<Queue>;
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    emailService = {
      sendEmail: jest.fn(),
    };
    service = new EmailSchedulerService(
      emailQueue,
      auditLogRepo,
      emailService as unknown as EmailService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('schedules email and records audit action', async () => {
    emailQueue.add.mockResolvedValue({
      id: 'job-1',
    } as unknown as Job);
    const scheduledAt = new Date(Date.now() + 10 * 60 * 1000);

    const result = await service.scheduleEmail(
      {
        subject: 'Reminder',
        body: 'Body',
        from: 'sender@mailzen.com',
        to: ['one@mailzen.com'],
        providerId: 'provider-1',
        scheduledAt,
      },
      'user-1',
    );

    expect(emailQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        userId: 'user-1',
      }),
      expect.objectContaining({
        delay: expect.any(Number),
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_schedule_created',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'job-1',
      }),
    );
  });

  it('records schedule creation failure when scheduled date missing', async () => {
    await expect(
      service.scheduleEmail(
        {
          subject: 'Reminder',
          body: 'Body',
          from: 'sender@mailzen.com',
          to: ['one@mailzen.com'],
          providerId: 'provider-1',
        },
        'user-1',
      ),
    ).rejects.toThrow('Scheduled date is required');

    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_schedule_creation_failed',
      }),
    );
  });

  it('cancels scheduled email and records audit action', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    emailQueue.getJob.mockResolvedValue({
      id: 'job-1',
      data: {
        userId: 'user-1',
      },
      remove,
    } as unknown as Job);

    const result = await service.cancelScheduledEmail('job-1', 'user-1');

    expect(remove).toHaveBeenCalledTimes(1);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_schedule_cancelled',
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('records cancellation failure when user mismatches owner', async () => {
    emailQueue.getJob.mockResolvedValue({
      id: 'job-2',
      data: {
        userId: 'user-2',
      },
      remove: jest.fn(),
    } as unknown as Job);

    await expect(service.cancelScheduledEmail('job-2', 'user-1')).rejects.toThrow(
      'Unauthorized to cancel this email',
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_schedule_cancel_failed',
      }),
    );
  });

  it('records dispatch success and failure audit actions', async () => {
    emailService.sendEmail.mockResolvedValueOnce({
      id: 'email-1',
    } as never);

    const successResult = await service.processScheduledEmail({
      id: 'job-success',
      data: {
        input: {
          subject: 'A',
          body: 'B',
          from: 'sender@mailzen.com',
          to: ['one@mailzen.com'],
          providerId: 'provider-1',
        },
        userId: 'user-1',
      },
    } as unknown as Job);

    expect(successResult).toEqual(
      expect.objectContaining({
        id: 'email-1',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_schedule_dispatched',
      }),
    );

    emailService.sendEmail.mockRejectedValueOnce(new Error('send failed'));
    await expect(
      service.processScheduledEmail({
        id: 'job-fail',
        data: {
          input: {
            subject: 'A',
            body: 'B',
            from: 'sender@mailzen.com',
            to: ['one@mailzen.com'],
            providerId: 'provider-1',
          },
          userId: 'user-1',
        },
      } as unknown as Job),
    ).rejects.toThrow('send failed');
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_schedule_dispatch_failed',
      }),
    );
  });

  it('continues scheduling when audit persistence fails', async () => {
    emailQueue.add.mockResolvedValue({
      id: 'job-3',
    } as unknown as Job);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));
    const scheduledAt = new Date(Date.now() + 5 * 60 * 1000);

    const result = await service.scheduleEmail(
      {
        subject: 'Reminder',
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
        id: 'job-3',
      }),
    );
  });
});
