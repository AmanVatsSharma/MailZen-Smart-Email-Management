/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { MailerService } from '@nestjs-modules/mailer';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationDigestScheduler } from './notification-digest.scheduler';

describe('NotificationDigestScheduler', () => {
  let scheduler: NotificationDigestScheduler;
  let preferenceRepo: jest.Mocked<Repository<UserNotificationPreference>>;
  let notificationRepo: jest.Mocked<Repository<UserNotification>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let mailerService: jest.Mocked<Pick<MailerService, 'sendMail'>>;

  beforeEach(() => {
    preferenceRepo = {
      find: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotificationPreference>>;
    notificationRepo = {
      find: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotification>>;
    userRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    mailerService = {
      sendMail: jest.fn(),
    };

    scheduler = new NotificationDigestScheduler(
      preferenceRepo,
      notificationRepo,
      userRepo,
      mailerService as unknown as MailerService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends digest email and updates last-sent timestamp', async () => {
    const preference = {
      id: 'pref-1',
      userId: 'user-1',
      emailEnabled: true,
      notificationDigestEnabled: true,
      notificationDigestLastSentAt: null,
    } as UserNotificationPreference;
    preferenceRepo.find.mockResolvedValue([preference]);
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
    } as User);
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-1',
        type: 'SYNC_FAILED',
        title: 'Sync failed',
        message: 'Provider sync failed',
        createdAt: new Date('2026-02-16T03:00:00.000Z'),
      } as UserNotification,
    ]);
    notificationRepo.count.mockResolvedValue(1);
    mailerService.sendMail.mockResolvedValue({} as never);
    preferenceRepo.save.mockImplementation(
      (value: UserNotificationPreference) => Promise.resolve(value),
    );

    await scheduler.sendUnreadDigestEmails();

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@mailzen.com',
        subject: '[MailZen] 1 unread notifications',
      }),
    );
    expect(preferenceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pref-1',
        notificationDigestLastSentAt: expect.any(Date),
      }),
    );
  });

  it('skips digest send when no unread notifications exist', async () => {
    preferenceRepo.find.mockResolvedValue([
      {
        id: 'pref-1',
        userId: 'user-1',
        emailEnabled: true,
        notificationDigestEnabled: true,
      } as UserNotificationPreference,
    ]);
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
    } as User);
    notificationRepo.find.mockResolvedValue([]);

    await scheduler.sendUnreadDigestEmails();

    expect(mailerService.sendMail).not.toHaveBeenCalled();
    expect(preferenceRepo.save).not.toHaveBeenCalled();
  });

  it('does not update digest timestamp when mail send fails', async () => {
    preferenceRepo.find.mockResolvedValue([
      {
        id: 'pref-1',
        userId: 'user-1',
        emailEnabled: true,
        notificationDigestEnabled: true,
      } as UserNotificationPreference,
    ]);
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
    } as User);
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-1',
        type: 'SYNC_FAILED',
        title: 'Sync failed',
        message: 'Provider sync failed',
        createdAt: new Date('2026-02-16T03:00:00.000Z'),
      } as UserNotification,
    ]);
    notificationRepo.count.mockResolvedValue(1);
    mailerService.sendMail.mockRejectedValue(new Error('smtp down'));

    await scheduler.sendUnreadDigestEmails();

    expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
    expect(preferenceRepo.save).not.toHaveBeenCalled();
  });

  it('queries only digest-enabled preferences', async () => {
    preferenceRepo.find.mockResolvedValue([]);

    await scheduler.sendUnreadDigestEmails();

    expect(preferenceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          emailEnabled: true,
          notificationDigestEnabled: true,
        },
      }),
    );
  });
});
