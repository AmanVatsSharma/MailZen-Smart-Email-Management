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

  const basePreference = {
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
    mailboxInboundSlaAlertsEnabled: true,
    mailboxInboundSlaLastAlertStatus: null,
    mailboxInboundSlaLastAlertedAt: null,
  } satisfies Partial<UserNotificationPreference>;

  it('creates unread notifications for users', async () => {
    const preferences = {
      ...basePreference,
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
      ...basePreference,
      syncFailureEnabled: false,
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
      ...basePreference,
    } as UserNotificationPreference);
    preferenceRepo.save.mockImplementation(
      (value: UserNotificationPreference) => Promise.resolve(value),
    );

    const result = await service.updatePreferences('user-1', {
      emailEnabled: false,
      pushEnabled: true,
      mailboxInboundRejectedEnabled: false,
      mailboxInboundSlaAlertsEnabled: false,
    });

    expect(result.emailEnabled).toBe(false);
    expect(result.pushEnabled).toBe(true);
    expect(result.mailboxInboundRejectedEnabled).toBe(false);
    expect(result.mailboxInboundSlaAlertsEnabled).toBe(false);
  });

  it('normalizes inbound SLA thresholds when preferences are updated', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      ...basePreference,
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
      ...basePreference,
      mailboxInboundAcceptedEnabled: false,
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
      ...basePreference,
      mailboxInboundRejectedEnabled: false,
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

  it('honors mailbox inbound SLA alert preference and mutes SLA alerts', async () => {
    const preferences = {
      ...basePreference,
      mailboxInboundSlaAlertsEnabled: false,
    } as UserNotificationPreference;
    preferenceRepo.findOne.mockResolvedValue(preferences);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-muted-sla',
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );

    const result = await service.createNotification({
      userId: 'user-1',
      type: 'MAILBOX_INBOUND_SLA_ALERT',
      title: 'Mailbox inbound SLA critical',
      message: 'Inbound rejection rate crossed critical threshold',
      metadata: {
        slaStatus: 'CRITICAL',
      },
    });

    expect(result.isRead).toBe(true);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        ignoredByPreference: true,
        ignoredPreferenceKey: 'mailboxInboundSlaAlertsEnabled',
      }),
    );
  });

  it('persists mailbox inbound SLA alert state', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      ...basePreference,
    } as UserNotificationPreference);
    preferenceRepo.save.mockImplementation(
      (value: UserNotificationPreference) => Promise.resolve(value),
    );
    const now = new Date('2026-02-16T00:30:00.000Z');

    const result = await service.updateMailboxInboundSlaAlertState({
      userId: 'user-1',
      status: 'CRITICAL',
      alertedAt: now,
    });

    expect(result.mailboxInboundSlaLastAlertStatus).toBe('CRITICAL');
    expect(result.mailboxInboundSlaLastAlertedAt).toEqual(now);
  });

  it('filters notification list by provided types', async () => {
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-sla-1',
        type: 'MAILBOX_INBOUND_SLA_ALERT',
      } as UserNotification,
    ]);

    const result: UserNotification[] = await service.listNotificationsForUser({
      userId: 'user-1',
      limit: 5,
      types: ['MAILBOX_INBOUND_SLA_ALERT', '  '],
    });

    const findInput = notificationRepo.find.mock.calls[0]?.[0] as
      | {
          where?: Record<string, unknown>;
          take?: number;
        }
      | undefined;
    expect(findInput?.take).toBe(5);
    expect(findInput?.where?.userId).toBe('user-1');
    expect(findInput?.where?.type).toBeDefined();
    expect(result).toHaveLength(1);
  });
});
