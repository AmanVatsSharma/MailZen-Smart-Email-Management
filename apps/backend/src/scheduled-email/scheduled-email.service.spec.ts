/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { ScheduledEmailService } from './scheduled-email.service';
import { ScheduledEmail } from './scheduled-email.entity';

describe('ScheduledEmailService', () => {
  let service: ScheduledEmailService;
  let scheduledEmailRepo: jest.Mocked<Repository<ScheduledEmail>>;

  beforeEach(() => {
    scheduledEmailRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ScheduledEmail>>;
    service = new ScheduledEmailService(scheduledEmailRepo);
    jest.clearAllMocks();
  });

  it('creates scheduled email rows with user scope', async () => {
    scheduledEmailRepo.create.mockReturnValue({
      id: 'scheduled-1',
      subject: 'Follow up',
      userId: 'user-1',
      status: 'PENDING',
    } as ScheduledEmail);
    scheduledEmailRepo.save.mockResolvedValue({
      id: 'scheduled-1',
      subject: 'Follow up',
      userId: 'user-1',
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
});
