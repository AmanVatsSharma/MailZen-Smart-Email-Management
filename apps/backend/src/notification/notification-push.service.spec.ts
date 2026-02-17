/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { NotificationPushSubscription } from './entities/notification-push-subscription.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationPushService } from './notification-push.service';

jest.mock('web-push', () => ({
  sendNotification: jest.fn(),
  setVapidDetails: jest.fn(),
}));

const sendNotificationMock = webpush.sendNotification as jest.Mock;
const setVapidDetailsMock = webpush.setVapidDetails as jest.Mock;

describe('NotificationPushService', () => {
  let service: NotificationPushService;
  let subscriptionRepo: jest.Mocked<Repository<NotificationPushSubscription>>;
  const envBackup = {
    enabled: process.env.MAILZEN_WEB_PUSH_ENABLED,
    publicKey: process.env.MAILZEN_WEB_PUSH_VAPID_PUBLIC_KEY,
    privateKey: process.env.MAILZEN_WEB_PUSH_VAPID_PRIVATE_KEY,
    subject: process.env.MAILZEN_WEB_PUSH_VAPID_SUBJECT,
    maxFailureCount: process.env.MAILZEN_WEB_PUSH_MAX_FAILURE_COUNT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionRepo = {
      find: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<NotificationPushSubscription>>;
    service = new NotificationPushService(subscriptionRepo);
    delete process.env.MAILZEN_WEB_PUSH_ENABLED;
    delete process.env.MAILZEN_WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.MAILZEN_WEB_PUSH_VAPID_PRIVATE_KEY;
    delete process.env.MAILZEN_WEB_PUSH_VAPID_SUBJECT;
    delete process.env.MAILZEN_WEB_PUSH_MAX_FAILURE_COUNT;
  });

  afterEach(() => {
    process.env.MAILZEN_WEB_PUSH_ENABLED = envBackup.enabled;
    process.env.MAILZEN_WEB_PUSH_VAPID_PUBLIC_KEY = envBackup.publicKey;
    process.env.MAILZEN_WEB_PUSH_VAPID_PRIVATE_KEY = envBackup.privateKey;
    process.env.MAILZEN_WEB_PUSH_VAPID_SUBJECT = envBackup.subject;
    process.env.MAILZEN_WEB_PUSH_MAX_FAILURE_COUNT = envBackup.maxFailureCount;
  });

  it('skips push dispatch when web push is disabled', async () => {
    await service.dispatchNotificationCreated({
      id: 'notif-1',
      userId: 'user-1',
      title: 'Sync failed',
      message: 'Sync failed',
      type: 'SYNC_FAILED',
      isRead: false,
      workspaceId: null,
    } as UserNotification);

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('sends push notifications to active subscriptions', async () => {
    process.env.MAILZEN_WEB_PUSH_ENABLED = 'true';
    process.env.MAILZEN_WEB_PUSH_VAPID_PUBLIC_KEY = 'public-key';
    process.env.MAILZEN_WEB_PUSH_VAPID_PRIVATE_KEY = 'private-key';
    process.env.MAILZEN_WEB_PUSH_VAPID_SUBJECT = 'mailto:alerts@mailzen.com';
    subscriptionRepo.find.mockResolvedValue([
      {
        id: 'push-1',
        userId: 'user-1',
        endpoint: 'https://push.mailzen.test/sub-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
        isActive: true,
        failureCount: 2,
      } as NotificationPushSubscription,
    ]);
    subscriptionRepo.save.mockImplementation(
      (value: NotificationPushSubscription) => Promise.resolve(value),
    );
    sendNotificationMock.mockResolvedValue({} as never);

    await service.dispatchNotificationCreated({
      id: 'notif-1',
      userId: 'user-1',
      title: 'Sync failed',
      message: 'Sync failed',
      type: 'SYNC_FAILED',
      isRead: false,
      workspaceId: 'workspace-1',
      createdAt: new Date('2026-02-16T00:00:00.000Z'),
    } as UserNotification);

    expect(setVapidDetailsMock).toHaveBeenCalled();
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        failureCount: 0,
        isActive: true,
      }),
    );
  });

  it('deactivates stale subscriptions on gone status', async () => {
    process.env.MAILZEN_WEB_PUSH_ENABLED = 'true';
    process.env.MAILZEN_WEB_PUSH_VAPID_PUBLIC_KEY = 'public-key';
    process.env.MAILZEN_WEB_PUSH_VAPID_PRIVATE_KEY = 'private-key';
    subscriptionRepo.find.mockResolvedValue([
      {
        id: 'push-1',
        userId: 'user-1',
        endpoint: 'https://push.mailzen.test/sub-1',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
        isActive: true,
        failureCount: 0,
      } as NotificationPushSubscription,
    ]);
    subscriptionRepo.save.mockImplementation(
      (value: NotificationPushSubscription) => Promise.resolve(value),
    );
    sendNotificationMock.mockRejectedValue({
      statusCode: 410,
      message: 'gone',
    } as never);

    await service.dispatchNotificationCreated({
      id: 'notif-1',
      userId: 'user-1',
      title: 'Sync failed',
      message: 'Sync failed',
      type: 'SYNC_FAILED',
      isRead: false,
      workspaceId: null,
    } as UserNotification);

    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
        failureCount: 1,
      }),
    );
  });
});
