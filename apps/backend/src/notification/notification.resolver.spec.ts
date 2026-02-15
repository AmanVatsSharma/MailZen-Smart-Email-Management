/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NotificationResolver } from './notification.resolver';

describe('NotificationResolver', () => {
  const notificationService = {
    listNotificationsForUser: jest.fn(),
    getMailboxInboundSlaIncidentStats: jest.fn(),
    getMailboxInboundSlaIncidentSeries: jest.fn(),
    markNotificationsRead: jest.fn(),
    getUnreadCount: jest.fn(),
    getOrCreatePreferences: jest.fn(),
    markNotificationRead: jest.fn(),
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
});
