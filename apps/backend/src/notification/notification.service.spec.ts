/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { NotificationPushSubscription } from './entities/notification-push-subscription.entity';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationPushService } from './notification-push.service';
import { NotificationService } from './notification.service';
import { NotificationWebhookService } from './notification-webhook.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: jest.Mocked<Repository<UserNotification>>;
  let preferenceRepo: jest.Mocked<Repository<UserNotificationPreference>>;
  let pushSubscriptionRepo: jest.Mocked<
    Repository<NotificationPushSubscription>
  >;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  let webhookService: jest.Mocked<
    Pick<
      NotificationWebhookService,
      'dispatchNotificationCreated' | 'dispatchNotificationsMarkedRead'
    >
  >;
  let pushService: jest.Mocked<
    Pick<NotificationPushService, 'dispatchNotificationCreated'>
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
    pushSubscriptionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<NotificationPushSubscription>>;
    auditLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    webhookService = {
      dispatchNotificationCreated: jest.fn(),
      dispatchNotificationsMarkedRead: jest.fn(),
    };
    pushService = {
      dispatchNotificationCreated: jest.fn(),
    };

    service = new NotificationService(
      notificationRepo,
      preferenceRepo,
      pushSubscriptionRepo,
      auditLogRepo,
      webhookService as unknown as NotificationWebhookService,
      pushService as unknown as NotificationPushService,
    );
    auditLogRepo.create.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    auditLogRepo.save.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
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
    expect(pushService.dispatchNotificationCreated).not.toHaveBeenCalled();
  });

  it('dispatches push notifications when push channel is enabled', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      ...basePreference,
      pushEnabled: true,
    } as UserNotificationPreference);
    const created = {
      id: 'notif-push-1',
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Push alert',
      message: 'Sync failed for workspace',
      isRead: false,
      workspaceId: 'workspace-1',
    } as UserNotification;
    notificationRepo.create.mockReturnValue(created);
    notificationRepo.save.mockResolvedValue(created);

    await service.createNotification({
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Push alert',
      message: 'Sync failed for workspace',
      metadata: { workspaceId: 'workspace-1' },
    });

    expect(pushService.dispatchNotificationCreated).toHaveBeenCalledWith(
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
        notificationTitle: 'Sync failed',
        notificationMessage: 'Provider sync failed',
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

  it('applies sync failure preference gate to sync recovered events', async () => {
    const preferences = {
      ...basePreference,
      syncFailureEnabled: false,
    } as UserNotificationPreference;
    preferenceRepo.findOne.mockResolvedValue(preferences);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-sync-recovered-ignored',
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );

    const result = await service.createNotification({
      userId: 'user-1',
      type: 'SYNC_RECOVERED',
      title: 'Gmail sync recovered',
      message: 'sync recovered',
      metadata: { providerId: 'provider-1' },
    });

    expect(result.isRead).toBe(true);
    expect(result.metadata).toEqual(
      expect.objectContaining({ ignoredByPreference: true }),
    );
  });

  it('applies sync failure preference gate to mailbox sync incident alerts', async () => {
    const preferences = {
      ...basePreference,
      syncFailureEnabled: false,
    } as UserNotificationPreference;
    preferenceRepo.findOne.mockResolvedValue(preferences);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-sync-incident-ignored',
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );

    const result = await service.createNotification({
      userId: 'user-1',
      type: 'MAILBOX_SYNC_INCIDENT_ALERT',
      title: 'Mailbox sync incidents warning',
      message: 'incident detected',
      metadata: { incidentStatus: 'WARNING' },
    });

    expect(result.isRead).toBe(true);
    expect(result.metadata).toEqual(
      expect.objectContaining({ ignoredByPreference: true }),
    );
  });

  it('applies sync failure preference gate to provider sync incident alerts', async () => {
    const preferences = {
      ...basePreference,
      syncFailureEnabled: false,
    } as UserNotificationPreference;
    preferenceRepo.findOne.mockResolvedValue(preferences);
    notificationRepo.create.mockImplementation(
      (value: Partial<UserNotification>) =>
        ({
          id: 'notif-provider-sync-incident-ignored',
          ...value,
        }) as UserNotification,
    );
    notificationRepo.save.mockImplementation((value: UserNotification) =>
      Promise.resolve(value),
    );

    const result = await service.createNotification({
      userId: 'user-1',
      type: 'PROVIDER_SYNC_INCIDENT_ALERT',
      title: 'Provider sync incident warning',
      message: 'incident detected',
      metadata: { status: 'WARNING' },
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
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'notification_marked_read',
      }),
    );
  });

  it('throws for missing notifications', async () => {
    notificationRepo.findOne.mockResolvedValue(null);

    await expect(
      service.markNotificationRead('missing', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('continues markNotificationRead when audit persistence fails', async () => {
    notificationRepo.findOne.mockResolvedValue({
      id: 'notif-2',
      userId: 'user-1',
      isRead: false,
    } as UserNotification);
    notificationRepo.save.mockResolvedValue({
      id: 'notif-2',
      userId: 'user-1',
      isRead: true,
    } as UserNotification);
    auditLogRepo.save.mockRejectedValue(
      new Error('audit datastore unavailable'),
    );

    await expect(
      service.markNotificationRead('notif-2', 'user-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'notif-2',
        isRead: true,
      }),
    );
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
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'notification_preferences_updated',
      }),
    );
  });

  it('exports notification data snapshot for legal/compliance portability', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      ...basePreference,
      pushEnabled: true,
    } as UserNotificationPreference);
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-export-1',
        userId: 'user-1',
        workspaceId: null,
        type: 'SYNC_FAILED',
        title: 'Sync failed',
        message: 'Provider failed',
        isRead: false,
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
        updatedAt: new Date('2026-02-16T00:00:00.000Z'),
      } as unknown as UserNotification,
    ]);
    pushSubscriptionRepo.find.mockResolvedValue([
      {
        id: 'push-1',
        userId: 'user-1',
        endpoint: 'https://push.mailzen.test/sub-1',
        isActive: true,
        failureCount: 0,
        workspaceId: null,
        updatedAt: new Date('2026-02-16T00:00:00.000Z'),
      } as NotificationPushSubscription,
    ]);

    const result = await service.exportNotificationData({
      userId: 'user-1',
      limit: 100,
    });

    expect(result.generatedAtIso).toBeTruthy();
    expect(result.dataJson).toContain('"preferences"');
    expect(result.dataJson).toContain('"notifications"');
    expect(result.dataJson).toContain('"pushSubscriptions"');
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'notification_data_export_requested',
      }),
    );
  });

  it('purges expired read notifications and disabled push subscriptions', async () => {
    const notificationDeleteBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 5 }),
    };
    const pushDeleteBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    notificationRepo.createQueryBuilder.mockReturnValueOnce(
      notificationDeleteBuilder as any,
    );
    pushSubscriptionRepo.createQueryBuilder.mockReturnValueOnce(
      pushDeleteBuilder as any,
    );

    const result = await service.purgeNotificationRetentionData({
      notificationRetentionDays: 200,
      disabledPushRetentionDays: 120,
    });

    expect(result.notificationsDeleted).toBe(5);
    expect(result.pushSubscriptionsDeleted).toBe(2);
    expect(result.notificationRetentionDays).toBe(200);
    expect(result.disabledPushRetentionDays).toBe(120);
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
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'notification_mailbox_inbound_sla_state_updated',
      }),
    );
  });

  it('filters notification list by provided types', async () => {
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-sla-1',
        type: 'MAILBOX_INBOUND_SLA_ALERT',
      } as unknown as UserNotification,
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
      } as unknown as UserNotification,
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

  it('exports mailbox inbound SLA incident analytics payload', async () => {
    const statsSpy = jest
      .spyOn(service, 'getMailboxInboundSlaIncidentStats')
      .mockResolvedValue({
        workspaceId: 'workspace-1',
        windowHours: 24,
        totalCount: 3,
        warningCount: 2,
        criticalCount: 1,
        lastAlertAt: new Date('2026-02-16T02:00:00.000Z'),
      });
    const seriesSpy = jest
      .spyOn(service, 'getMailboxInboundSlaIncidentSeries')
      .mockResolvedValue([
        {
          bucketStart: new Date('2026-02-16T01:00:00.000Z'),
          totalCount: 2,
          warningCount: 1,
          criticalCount: 1,
        },
      ]);
    const alertsSpy = jest
      .spyOn(service, 'getMailboxInboundSlaIncidentAlerts')
      .mockResolvedValue([
        {
          notificationId: 'notif-1',
          workspaceId: 'workspace-1',
          slaStatus: 'WARNING',
          title: 'Mailbox inbound SLA warning',
          message: 'warning',
          totalCount: 3,
          acceptedCount: 2,
          deduplicatedCount: 0,
          rejectedCount: 1,
          successRatePercent: 66.67,
          rejectionRatePercent: 33.33,
          createdAt: new Date('2026-02-16T01:30:00.000Z'),
        },
      ]);

    const exported = await service.exportMailboxInboundSlaIncidentData({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
      limit: 10,
    });

    expect(statsSpy).toHaveBeenCalledTimes(1);
    expect(seriesSpy).toHaveBeenCalledTimes(1);
    expect(alertsSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(exported.dataJson) as {
      stats: { totalCount: number };
      series: Array<{ totalCount: number }>;
      alertCount: number;
      alerts: Array<{ notificationId: string }>;
    };
    expect(payload.stats.totalCount).toBe(3);
    expect(payload.series[0]?.totalCount).toBe(2);
    expect(payload.alertCount).toBe(1);
    expect(payload.alerts[0]?.notificationId).toBe('notif-1');
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'notification_mailbox_inbound_sla_export_requested',
      }),
    );
  });

  it('lists mailbox inbound SLA incident alert notifications', async () => {
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        type: 'MAILBOX_INBOUND_SLA_ALERT',
        title: 'Mailbox inbound SLA warning',
        message: 'warning',
        metadata: {
          slaStatus: 'WARNING',
          totalCount: 3,
          acceptedCount: 2,
          deduplicatedCount: 0,
          rejectedCount: 1,
          successRatePercent: 66.67,
          rejectionRatePercent: 33.33,
        },
        createdAt: new Date('2026-02-16T01:30:00.000Z'),
      } as unknown as UserNotification,
    ]);

    const rows = await service.getMailboxInboundSlaIncidentAlerts({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      limit: 20,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        notificationId: 'notif-1',
        workspaceId: 'workspace-1',
        slaStatus: 'WARNING',
        totalCount: 3,
      }),
    ]);
  });

  it('returns mailbox inbound SLA incident alert config snapshot', async () => {
    preferenceRepo.findOne.mockResolvedValue({
      ...basePreference,
      mailboxInboundSlaAlertsEnabled: false,
      mailboxInboundSlaTargetSuccessPercent: 98.5,
      mailboxInboundSlaWarningRejectedPercent: 2,
      mailboxInboundSlaCriticalRejectedPercent: 6,
      mailboxInboundSlaAlertCooldownMinutes: 45,
    } as UserNotificationPreference);
    process.env.MAILZEN_INBOUND_SLA_ALERT_WINDOW_HOURS = '36';
    process.env.MAILZEN_INBOUND_SLA_ALERT_COOLDOWN_MINUTES = '75';
    process.env.MAILZEN_INBOUND_SLA_ALERT_MAX_USERS_PER_RUN = '250';

    const config = await service.getMailboxInboundSlaIncidentAlertConfig({
      userId: 'user-1',
    });

    expect(config).toEqual(
      expect.objectContaining({
        schedulerAlertsEnabled: true,
        alertsEnabled: false,
        targetSuccessPercent: 98.5,
        warningRejectedPercent: 2,
        criticalRejectedPercent: 6,
        cooldownMinutes: 45,
        schedulerWindowHours: 36,
        schedulerCooldownMinutes: 75,
        schedulerMaxUsersPerRun: 250,
      }),
    );
  });

  it('marks mailbox inbound SLA scheduler as disabled in config snapshot when env disables alerts', async () => {
    const previous = process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED;
    preferenceRepo.findOne.mockResolvedValue(
      basePreference as UserNotificationPreference,
    );
    process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED = 'false';

    const config = await service.getMailboxInboundSlaIncidentAlertConfig({
      userId: 'user-1',
    });

    expect(config.schedulerAlertsEnabled).toBe(false);
    expect(config.alertsEnabled).toBe(true);
    if (previous === undefined) {
      delete process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED;
    } else {
      process.env.MAILZEN_INBOUND_SLA_ALERTS_ENABLED = previous;
    }
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
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'notification_bulk_marked_read',
      }),
    );
  });

  it('registers push subscriptions for current user', async () => {
    pushSubscriptionRepo.findOne.mockResolvedValue(null);
    pushSubscriptionRepo.find.mockResolvedValue([]);
    pushSubscriptionRepo.create.mockImplementation(
      (value: Partial<NotificationPushSubscription>) =>
        ({
          id: 'push-1',
          ...value,
        }) as NotificationPushSubscription,
    );
    pushSubscriptionRepo.save.mockImplementation(
      (value: NotificationPushSubscription) => Promise.resolve(value),
    );

    const result = await service.registerPushSubscription({
      userId: 'user-1',
      payload: {
        endpoint: 'https://push.mailzen.test/sub-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
        workspaceId: 'workspace-1',
        userAgent: 'Chrome',
      },
    });

    expect(result.endpoint).toBe('https://push.mailzen.test/sub-1');
    expect(result.workspaceId).toBe('workspace-1');
    expect(pushSubscriptionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        isActive: true,
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'notification_push_subscription_registered',
      }),
    );
  });

  it('deactivates push subscriptions when unregistering', async () => {
    pushSubscriptionRepo.findOne.mockResolvedValue({
      id: 'push-1',
      userId: 'user-1',
      endpoint: 'https://push.mailzen.test/sub-1',
      p256dh: 'p256dh-key',
      auth: 'auth-key',
      isActive: true,
      failureCount: 0,
      workspaceId: null,
      userAgent: null,
      lastDeliveredAt: null,
      lastFailureAt: null,
    } as NotificationPushSubscription);
    pushSubscriptionRepo.save.mockImplementation(
      (value: NotificationPushSubscription) => Promise.resolve(value),
    );

    const result = await service.unregisterPushSubscription({
      userId: 'user-1',
      endpoint: 'https://push.mailzen.test/sub-1',
    });

    expect(result).toBe(true);
    expect(pushSubscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'notification_push_subscription_unregistered',
      }),
    );
  });
});
