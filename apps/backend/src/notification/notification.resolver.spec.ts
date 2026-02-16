/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NotificationResolver } from './notification.resolver';

describe('NotificationResolver', () => {
  const notificationService = {
    listNotificationsForUser: jest.fn(),
    getMailboxInboundSlaIncidentStats: jest.fn(),
    getMailboxInboundSlaIncidentSeries: jest.fn(),
    exportMailboxInboundSlaIncidentData: jest.fn(),
    markNotificationsRead: jest.fn(),
    getUnreadCount: jest.fn(),
    getOrCreatePreferences: jest.fn(),
    listPushSubscriptionsForUser: jest.fn(),
    exportNotificationData: jest.fn(),
    markNotificationRead: jest.fn(),
    registerPushSubscription: jest.fn(),
    unregisterPushSubscription: jest.fn(),
    purgeNotificationRetentionData: jest.fn(),
    updatePreferences: jest.fn(),
  };

  const resolver = new NotificationResolver(notificationService as any);
  const context = {
    req: {
      user: {
        id: 'user-1',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes optional type filters to myNotifications', async () => {
    notificationService.listNotificationsForUser.mockResolvedValue([]);

    await resolver.myNotifications(
      15,
      false,
      context as never,
      'workspace-1',
      24,
      ['MAILBOX_INBOUND_SLA_ALERT'],
    );

    expect(notificationService.listNotificationsForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 15,
      unreadOnly: false,
      workspaceId: 'workspace-1',
      sinceHours: 24,
      types: ['MAILBOX_INBOUND_SLA_ALERT'],
    });
  });

  it('falls back to empty type filters when omitted', async () => {
    notificationService.listNotificationsForUser.mockResolvedValue([]);

    await resolver.myNotifications(
      10,
      false,
      context as never,
      undefined,
      undefined,
    );

    expect(notificationService.listNotificationsForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 10,
      unreadOnly: false,
      workspaceId: null,
      sinceHours: null,
      types: [],
    });
  });

  it('forwards SLA incident stats query arguments', async () => {
    notificationService.getMailboxInboundSlaIncidentStats.mockResolvedValue({
      workspaceId: 'workspace-1',
      windowHours: 24,
      totalCount: 3,
      warningCount: 2,
      criticalCount: 1,
      lastAlertAt: null,
    });

    await resolver.myMailboxInboundSlaIncidentStats(
      'workspace-1',
      24,
      context as never,
    );

    expect(
      notificationService.getMailboxInboundSlaIncidentStats,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
    });
  });

  it('forwards SLA incident series query arguments', async () => {
    notificationService.getMailboxInboundSlaIncidentSeries.mockResolvedValue(
      [],
    );

    await resolver.myMailboxInboundSlaIncidentSeries(
      'workspace-1',
      24,
      60,
      context as never,
    );

    expect(
      notificationService.getMailboxInboundSlaIncidentSeries,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
    });
  });

  it('forwards SLA incident data export query arguments', async () => {
    notificationService.exportMailboxInboundSlaIncidentData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"stats":{"totalCount":3}}',
    });

    await resolver.myMailboxInboundSlaIncidentDataExport(
      'workspace-1',
      24,
      60,
      context as never,
    );

    expect(
      notificationService.exportMailboxInboundSlaIncidentData,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
    });
  });

  it('forwards workspace context to unread count query', async () => {
    notificationService.getUnreadCount.mockResolvedValue(4);

    await resolver.myUnreadNotificationCount(context as never, 'workspace-1');

    expect(notificationService.getUnreadCount).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );
  });

  it('forwards mark notifications read mutation filters', async () => {
    notificationService.markNotificationsRead.mockResolvedValue(2);

    await resolver.markMyNotificationsRead(
      'workspace-1',
      context as never,
      24,
      ['MAILBOX_INBOUND_SLA_ALERT'],
    );

    expect(notificationService.markNotificationsRead).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      sinceHours: 24,
      types: ['MAILBOX_INBOUND_SLA_ALERT'],
    });
  });

  it('forwards push subscription list query params', async () => {
    notificationService.listPushSubscriptionsForUser.mockResolvedValue([]);

    await resolver.myNotificationPushSubscriptions(
      context as never,
      'workspace-1',
    );

    expect(
      notificationService.listPushSubscriptionsForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('forwards notification data export query payload', async () => {
    notificationService.exportNotificationData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"notifications":[]}',
    });

    await resolver.myNotificationDataExport(context as never, 120);

    expect(notificationService.exportNotificationData).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 120,
    });
  });

  it('forwards push registration mutation payload', async () => {
    notificationService.registerPushSubscription.mockResolvedValue({
      id: 'push-1',
    });

    await resolver.registerMyNotificationPushSubscription(
      {
        endpoint: 'https://push.mailzen.test/sub-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
        workspaceId: 'workspace-1',
      },
      context as never,
    );

    expect(notificationService.registerPushSubscription).toHaveBeenCalledWith({
      userId: 'user-1',
      payload: {
        endpoint: 'https://push.mailzen.test/sub-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
        workspaceId: 'workspace-1',
      },
    });
  });

  it('forwards push unregistration mutation payload', async () => {
    notificationService.unregisterPushSubscription.mockResolvedValue(true);

    await resolver.unregisterMyNotificationPushSubscription(
      'https://push.mailzen.test/sub-1',
      context as never,
    );

    expect(notificationService.unregisterPushSubscription).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        endpoint: 'https://push.mailzen.test/sub-1',
      },
    );
  });

  it('forwards retention purge mutation payload', async () => {
    notificationService.purgeNotificationRetentionData.mockResolvedValue({
      notificationsDeleted: 12,
      pushSubscriptionsDeleted: 3,
      notificationRetentionDays: 180,
      disabledPushRetentionDays: 90,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    await resolver.purgeNotificationRetentionData(180, 120);

    expect(
      notificationService.purgeNotificationRetentionData,
    ).toHaveBeenCalledWith({
      notificationRetentionDays: 180,
      disabledPushRetentionDays: 120,
    });
  });
});
