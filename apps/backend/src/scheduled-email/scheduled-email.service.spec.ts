/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { ScheduledEmailService } from './scheduled-email.service';
import { ScheduledEmail } from './scheduled-email.entity';

describe('ScheduledEmailService', () => {
  let service: ScheduledEmailService;
  let scheduledEmailRepo: jest.Mocked<Repository<ScheduledEmail>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(() => {
    scheduledEmailRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ScheduledEmail>>;
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    service = new ScheduledEmailService(scheduledEmailRepo, auditLogRepo);
    jest.clearAllMocks();
  });

  it('creates scheduled email rows with user scope', async () => {
    scheduledEmailRepo.create.mockReturnValue({
      id: 'scheduled-1',
      subject: 'Follow up',
      userId: 'user-1',
      recipientIds: ['contact-1'],
      scheduledAt: new Date('2026-02-17T00:00:00.000Z'),
      status: 'PENDING',
    } as ScheduledEmail);
    scheduledEmailRepo.save.mockResolvedValue({
      id: 'scheduled-1',
      subject: 'Follow up',
      userId: 'user-1',
      recipientIds: ['contact-1'],
      scheduledAt: new Date('2026-02-17T00:00:00.000Z'),
      status: 'PENDING',
    } as ScheduledEmail);

    const result = await service.createScheduledEmail(
      {
        subject: 'Follow up',
        body: 'Reminder body',
        recipientIds: ['contact-1'],
        scheduledAt: new Date('2026-02-17T00:00:00.000Z'),
        status: 'PENDING',
      },
      'user-1',
    );

    expect(scheduledEmailRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Follow up',
        userId: 'user-1',
        status: 'PENDING',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'scheduled-1',
        userId: 'user-1',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'scheduled_email_created',
      }),
    );
  });

  it('lists scheduled emails for user', async () => {
    scheduledEmailRepo.find.mockResolvedValue([
      {
        id: 'scheduled-1',
        userId: 'user-2',
      } as ScheduledEmail,
    ]);

    const result = await service.getAllScheduledEmails('user-2');

    expect(scheduledEmailRepo.find).toHaveBeenCalledWith({
      where: { userId: 'user-2' },
      order: { scheduledAt: 'ASC' },
    });
    expect(result).toHaveLength(1);
  });

  it('continues create flow when audit persistence fails', async () => {
    scheduledEmailRepo.create.mockReturnValue({
      id: 'scheduled-2',
      subject: 'Follow up 2',
      userId: 'user-1',
      status: 'PENDING',
    } as ScheduledEmail);
    scheduledEmailRepo.save.mockResolvedValue({
      id: 'scheduled-2',
      subject: 'Follow up 2',
      userId: 'user-1',
      recipientIds: ['contact-2'],
      scheduledAt: new Date('2026-02-18T00:00:00.000Z'),
      status: 'PENDING',
    } as ScheduledEmail);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.createScheduledEmail(
      {
        subject: 'Follow up 2',
        body: 'Reminder body 2',
        recipientIds: ['contact-2'],
        scheduledAt: new Date('2026-02-18T00:00:00.000Z'),
        status: 'PENDING',
      },
      'user-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'scheduled-2',
        userId: 'user-1',
      }),
    );
  });
});
