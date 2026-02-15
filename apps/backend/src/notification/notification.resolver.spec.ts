/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NotificationResolver } from './notification.resolver';

describe('NotificationResolver', () => {
  const notificationService = {
    listNotificationsForUser: jest.fn(),
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

    await resolver.myNotifications(15, false, context as never, [
      'MAILBOX_INBOUND_SLA_ALERT',
    ]);

    expect(notificationService.listNotificationsForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 15,
      unreadOnly: false,
      types: ['MAILBOX_INBOUND_SLA_ALERT'],
    });
  });

  it('falls back to empty type filters when omitted', async () => {
    notificationService.listNotificationsForUser.mockResolvedValue([]);

    await resolver.myNotifications(10, false, context as never, undefined);

    expect(notificationService.listNotificationsForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 10,
      unreadOnly: false,
      types: [],
    });
  });
});
