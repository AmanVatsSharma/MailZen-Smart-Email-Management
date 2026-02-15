/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: jest.Mocked<Repository<UserNotification>>;
  let preferenceRepo: jest.Mocked<Repository<UserNotificationPreference>>;

  beforeEach(() => {
    notificationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotification>>;
    preferenceRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotificationPreference>>;

    service = new NotificationService(notificationRepo, preferenceRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates unread notifications for users', async () => {
    const preferences = {
      id: 'pref-1',
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      syncFailureEnabled: true,
      mailboxInboundAcceptedEnabled: true,
      mailboxInboundDeduplicatedEnabled: false,
      mailboxInboundRejectedEnabled: true,
      mailboxInboundSlaTargetSuccessPercent: 99,
      mailboxInboundSlaWarningRejectedPercent: 1,
      mailboxInboundSlaCriticalRejectedPercent: 5,
    } as UserNotificationPreference;
    preferenceRepo.findOne.mockResolvedValue(preferences);

    const created = {
      id: 'notif-1',
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Gmail sync failed',
      message: 'sync failed',
      isRead: false,
    } as UserNotification;
    notificationRepo.create.mockReturnValue(created);
    notificationRepo.save.mockResolvedValue(created);

    const result = await service.createNotification({
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Gmail sync failed',
      message: 'sync failed',
      metadata: { providerId: 'provider-1' },
    });

    expect(result).toEqual(created);
    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        isRead: false,
      }),
    );
  });

  it('honors sync failure preference and marks ignored notifications as read', async () => {
    const preferences = {
      id: 'pref-1',
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      syncFailureEnabled: false,
      mailboxInboundAcceptedEnabled: true,
      mailboxInboundDeduplicatedEnabled: false,
      mailboxInboundRejectedEnabled: true,
      mailboxInboundSlaTargetSuccessPercent: 99,
      mailboxInboundSlaWarningRejectedPercent: 1,
      mailboxInboundSlaCriticalRejectedPercent: 5,
    } as UserNotificationPreference;
    preferenceRepo.findOne.mockResolvedValue(preferences);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-ignored',
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );

    const result = await service.createNotification({
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Gmail sync failed',
      message: 'sync failed',
      metadata: { providerId: 'provider-1' },
    });

    expect(result.isRead).toBe(true);
    expect(result.metadata).toEqual(
      expect.objectContaining({ ignoredByPreference: true }),
    );
  });

  it('marks notifications as read', async () => {
    notificationRepo.findOne.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      isRead: false,
    } as UserNotification);
    notificationRepo.save.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      isRead: true,
    } as UserNotification);

    const result = await service.markNotificationRead('notif-1', 'user-1');
    expect(result.isRead).toBe(true);
  });

  it('throws for missing notifications', async () => {
    notificationRepo.findOne.mockResolvedValue(null);

    await expect(
      service.markNotificationRead('missing', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates persisted notification preferences', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      syncFailureEnabled: true,
      mailboxInboundAcceptedEnabled: true,
      mailboxInboundDeduplicatedEnabled: false,
      mailboxInboundRejectedEnabled: true,
      mailboxInboundSlaTargetSuccessPercent: 99,
      mailboxInboundSlaWarningRejectedPercent: 1,
      mailboxInboundSlaCriticalRejectedPercent: 5,
    } as UserNotificationPreference);
    preferenceRepo.save.mockImplementation(
      (value: UserNotificationPreference) => Promise.resolve(value),
    );

    const result = await service.updatePreferences('user-1', {
      emailEnabled: false,
      pushEnabled: true,
      mailboxInboundRejectedEnabled: false,
    });

    expect(result.emailEnabled).toBe(false);
    expect(result.pushEnabled).toBe(true);
    expect(result.mailboxInboundRejectedEnabled).toBe(false);
  });

  it('normalizes inbound SLA thresholds when preferences are updated', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      syncFailureEnabled: true,
      mailboxInboundAcceptedEnabled: true,
      mailboxInboundDeduplicatedEnabled: false,
      mailboxInboundRejectedEnabled: true,
      mailboxInboundSlaTargetSuccessPercent: 99,
      mailboxInboundSlaWarningRejectedPercent: 1,
      mailboxInboundSlaCriticalRejectedPercent: 5,
    } as UserNotificationPreference);
    preferenceRepo.save.mockImplementation(
      (value: UserNotificationPreference) => Promise.resolve(value),
    );

    const result = await service.updatePreferences('user-1', {
      mailboxInboundSlaTargetSuccessPercent: 101,
      mailboxInboundSlaWarningRejectedPercent: 10,
      mailboxInboundSlaCriticalRejectedPercent: 4,
    });

    expect(result.mailboxInboundSlaTargetSuccessPercent).toBe(100);
    expect(result.mailboxInboundSlaWarningRejectedPercent).toBe(4);
    expect(result.mailboxInboundSlaCriticalRejectedPercent).toBe(10);
  });

  it('honors mailbox inbound accepted preference and mutes accepted alerts', async () => {
    const preferences = {
      id: 'pref-1',
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      syncFailureEnabled: true,
      mailboxInboundAcceptedEnabled: false,
      mailboxInboundDeduplicatedEnabled: false,
      mailboxInboundRejectedEnabled: true,
      mailboxInboundSlaTargetSuccessPercent: 99,
      mailboxInboundSlaWarningRejectedPercent: 1,
      mailboxInboundSlaCriticalRejectedPercent: 5,
    } as UserNotificationPreference;
    preferenceRepo.findOne.mockResolvedValue(preferences);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-muted-mailbox',
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );

    const result = await service.createNotification({
      userId: 'user-1',
      type: 'MAILBOX_INBOUND',
      title: 'New email',
      message: 'From lead@example.com',
      metadata: {
        inboundStatus: 'ACCEPTED',
        mailboxEmail: 'sales@mailzen.com',
      },
    });

    expect(result.isRead).toBe(true);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        ignoredByPreference: true,
        ignoredPreferenceKey: 'mailboxInboundAcceptedEnabled',
      }),
    );
  });

  it('honors mailbox inbound rejected preference and mutes rejected alerts', async () => {
    const preferences = {
      id: 'pref-1',
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      syncFailureEnabled: true,
      mailboxInboundAcceptedEnabled: true,
      mailboxInboundDeduplicatedEnabled: false,
      mailboxInboundRejectedEnabled: false,
      mailboxInboundSlaTargetSuccessPercent: 99,
      mailboxInboundSlaWarningRejectedPercent: 1,
      mailboxInboundSlaCriticalRejectedPercent: 5,
    } as UserNotificationPreference;
    preferenceRepo.findOne.mockResolvedValue(preferences);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-muted-rejected',
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );

    const result = await service.createNotification({
      userId: 'user-1',
      type: 'MAILBOX_INBOUND',
      title: 'Inbound rejected',
      message: 'Quota exceeded',
      metadata: {
        inboundStatus: 'REJECTED',
        mailboxEmail: 'sales@mailzen.com',
      },
    });

    expect(result.isRead).toBe(true);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        ignoredByPreference: true,
        ignoredPreferenceKey: 'mailboxInboundRejectedEnabled',
      }),
    );
  });
});
