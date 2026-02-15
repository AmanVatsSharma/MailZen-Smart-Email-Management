/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationService } from './notification.service';
import { NotificationWebhookService } from './notification-webhook.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: jest.Mocked<Repository<UserNotification>>;
  let preferenceRepo: jest.Mocked<Repository<UserNotificationPreference>>;
  let webhookService: jest.Mocked<
    Pick<
      NotificationWebhookService,
      'dispatchNotificationCreated' | 'dispatchNotificationsMarkedRead'
    >
  >;

  beforeEach(() => {
    notificationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotification>>;
    preferenceRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotificationPreference>>;
    webhookService = {
      dispatchNotificationCreated: jest.fn(),
      dispatchNotificationsMarkedRead: jest.fn(),
    };

    service = new NotificationService(
      notificationRepo,
      preferenceRepo,
      webhookService as unknown as NotificationWebhookService,
    );
    notificationRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        totalCount: '0',
        warningCount: '0',
        criticalCount: '0',
        lastAlertAt: null,
      }),
    } as any);
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
    notificationDigestEnabled: true,
    mailboxInboundSlaAlertCooldownMinutes: 60,
    mailboxInboundSlaLastAlertStatus: null,
    mailboxInboundSlaLastAlertedAt: null,
    notificationDigestLastSentAt: null,
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
      metadata: { providerId: 'provider-1', workspaceId: 'workspace-1' },
    });

    expect(result).toEqual(created);
    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        isRead: false,
      }),
    );
    expect(webhookService.dispatchNotificationCreated).toHaveBeenCalledWith(
      created,
    );
  });

  it('emits realtime notification-created events for workspace subscribers', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      ...basePreference,
    } as UserNotificationPreference);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-live-1',
          createdAt: new Date('2026-02-16T03:10:00.000Z'),
          updatedAt: new Date('2026-02-16T03:10:00.000Z'),
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );
    const events: Array<Record<string, unknown>> = [];
    const subscription = service
      .observeRealtimeEvents({
        userId: 'user-1',
        workspaceId: 'workspace-1',
      })
      .subscribe((event) => {
        events.push(event as unknown as Record<string, unknown>);
      });

    await service.createNotification({
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Sync failed',
      message: 'Provider sync failed',
      metadata: { workspaceId: 'workspace-1' },
    });

    subscription.unsubscribe();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        eventType: 'NOTIFICATION_CREATED',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        notificationId: 'notif-live-1',
      }),
    );
  });

  it('includes global realtime events in workspace-scoped subscriptions', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      ...basePreference,
    } as UserNotificationPreference);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-global-1',
          createdAt: new Date('2026-02-16T03:11:00.000Z'),
          updatedAt: new Date('2026-02-16T03:11:00.000Z'),
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );
    const events: Array<Record<string, unknown>> = [];
    const subscription = service
      .observeRealtimeEvents({
        userId: 'user-1',
        workspaceId: 'workspace-1',
      })
      .subscribe((event) => {
        events.push(event as unknown as Record<string, unknown>);
      });

    await service.createNotification({
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Global sync failed',
      message: 'Global provider sync failed',
      metadata: {},
    });

    subscription.unsubscribe();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        eventType: 'NOTIFICATION_CREATED',
        userId: 'user-1',
        workspaceId: null,
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
    expect(webhookService.dispatchNotificationsMarkedRead).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        workspaceId: null,
        markedCount: 1,
      },
    );
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
      notificationDigestEnabled: false,
    });

    expect(result.emailEnabled).toBe(false);
    expect(result.pushEnabled).toBe(true);
    expect(result.mailboxInboundRejectedEnabled).toBe(false);
    expect(result.mailboxInboundSlaAlertsEnabled).toBe(false);
    expect(result.notificationDigestEnabled).toBe(false);
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

  it('normalizes SLA alert cooldown minutes when preferences are updated', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      ...basePreference,
    } as UserNotificationPreference);
    preferenceRepo.save.mockImplementation(
      (value: UserNotificationPreference) => Promise.resolve(value),
    );

    const result = await service.updatePreferences('user-1', {
      mailboxInboundSlaAlertCooldownMinutes: 0,
    });

    expect(result.mailboxInboundSlaAlertCooldownMinutes).toBe(1);
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
      sinceHours: 24,
      workspaceId: 'workspace-1',
    });

    const findInput = notificationRepo.find.mock.calls[0]?.[0] as
      | {
          where?: Record<string, unknown> | Array<Record<string, unknown>>;
          take?: number;
        }
      | undefined;
    expect(findInput?.take).toBe(5);
    const whereEntries = Array.isArray(findInput?.where) ? findInput.where : [];
    expect(whereEntries).toHaveLength(2);
    expect(whereEntries[0]?.userId).toBe('user-1');
    expect(whereEntries[0]?.workspaceId).toBe('workspace-1');
    expect(whereEntries[0]?.type).toBeDefined();
    expect(whereEntries[0]?.createdAt).toBeDefined();
    expect(whereEntries[1]?.workspaceId).toBeDefined();
    expect(result).toHaveLength(1);
  });

  it('returns mailbox inbound SLA incident aggregates', async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        totalCount: '8',
        warningCount: '5',
        criticalCount: '3',
        lastAlertAt: '2026-02-16T02:00:00.000Z',
      }),
    };
    notificationRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);

    const result = await service.getMailboxInboundSlaIncidentStats({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
    });

    expect(notificationRepo.createQueryBuilder).toHaveBeenCalledWith(
      'notification',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(notification.workspaceId = :workspaceId OR notification.workspaceId IS NULL)',
      { workspaceId: 'workspace-1' },
    );
    expect(result).toEqual({
      workspaceId: 'workspace-1',
      windowHours: 24,
      totalCount: 8,
      warningCount: 5,
      criticalCount: 3,
      lastAlertAt: new Date('2026-02-16T02:00:00.000Z'),
    });
  });

  it('returns mailbox inbound SLA incident trend series buckets', async () => {
    const nowMs = Date.now();
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'user-1',
        title: 'warn',
        message: 'warn',
        isRead: false,
        type: 'MAILBOX_INBOUND_SLA_ALERT',
        workspaceId: 'workspace-1',
        metadata: { slaStatus: 'WARNING' },
        createdAt: new Date(nowMs - 80 * 60 * 1000),
        updatedAt: new Date(nowMs - 80 * 60 * 1000),
      } as UserNotification,
      {
        id: 'notif-2',
        userId: 'user-1',
        title: 'critical',
        message: 'critical',
        isRead: false,
        type: 'MAILBOX_INBOUND_SLA_ALERT',
        workspaceId: 'workspace-1',
        metadata: { slaStatus: 'CRITICAL' },
        createdAt: new Date(nowMs - 20 * 60 * 1000),
        updatedAt: new Date(nowMs - 20 * 60 * 1000),
      } as UserNotification,
    ]);

    const series = await service.getMailboxInboundSlaIncidentSeries({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 2,
      bucketMinutes: 60,
    });

    expect(notificationRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'ASC' },
      }),
    );
    expect(series.length).toBeGreaterThanOrEqual(2);
    expect(series.some((point) => point.warningCount > 0)).toBe(true);
    expect(series.some((point) => point.criticalCount > 0)).toBe(true);
  });

  it('counts unread notifications scoped to workspace plus global rows', async () => {
    notificationRepo.count.mockResolvedValue(3);

    const count = await service.getUnreadCount('user-1', 'workspace-1');

    const countInput = notificationRepo.count.mock.calls[0]?.[0] as
      | {
          where?: Array<Record<string, unknown>> | Record<string, unknown>;
        }
      | undefined;
    const whereEntries = Array.isArray(countInput?.where)
      ? countInput.where
      : [];
    expect(whereEntries).toHaveLength(2);
    expect(whereEntries[0]?.userId).toBe('user-1');
    expect(whereEntries[0]?.workspaceId).toBe('workspace-1');
    expect(whereEntries[0]?.isRead).toBe(false);
    expect(whereEntries[1]?.workspaceId).toBeDefined();
    expect(count).toBe(3);
  });

  it('marks filtered notifications as read in bulk', async () => {
    const updateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 4 }),
    };
    notificationRepo.createQueryBuilder.mockReturnValue(
      updateQueryBuilder as any,
    );

    const events: Array<Record<string, unknown>> = [];
    const subscription = service
      .observeRealtimeEvents({
        userId: 'user-1',
        workspaceId: 'workspace-1',
      })
      .subscribe((event) => {
        events.push(event as unknown as Record<string, unknown>);
      });

    const updatedCount = await service.markNotificationsRead({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      sinceHours: 24,
      types: ['MAILBOX_INBOUND_SLA_ALERT'],
    });

    subscription.unsubscribe();

    expect(updateQueryBuilder.update).toHaveBeenCalled();
    expect(updateQueryBuilder.andWhere).toHaveBeenCalledWith(
      'type IN (:...types)',
      { types: ['MAILBOX_INBOUND_SLA_ALERT'] },
    );
    expect(updateQueryBuilder.andWhere).toHaveBeenCalledWith(
      '(workspaceId = :workspaceId OR workspaceId IS NULL)',
      { workspaceId: 'workspace-1' },
    );
    expect(updateQueryBuilder.execute).toHaveBeenCalled();
    expect(updatedCount).toBe(4);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        eventType: 'NOTIFICATIONS_MARKED_READ',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        markedCount: 4,
      }),
    );
    expect(webhookService.dispatchNotificationsMarkedRead).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        workspaceId: 'workspace-1',
        markedCount: 4,
      },
    );
  });
});
