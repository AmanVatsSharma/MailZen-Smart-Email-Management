import { NotificationEventBusService } from './notification-event-bus.service';
import { NotificationService } from './notification.service';

describe('NotificationEventBusService', () => {
  const notificationService = {
    createNotification: jest.fn(),
  } as unknown as jest.Mocked<Pick<NotificationService, 'createNotification'>>;
  const service = new NotificationEventBusService(
    notificationService as unknown as NotificationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes domain events through notification service', async () => {
    notificationService.createNotification.mockResolvedValue({
      id: 'notif-1',
    } as never);

    await service.publish({
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Sync failed',
      message: 'Provider sync failed',
      metadata: {
        providerId: 'provider-1',
      },
    });

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SYNC_FAILED',
      }),
    );
  });

  it('suppresses publish errors when using publishSafely', async () => {
    notificationService.createNotification.mockRejectedValue(
      new Error('write failed'),
    );

    const result = await service.publishSafely({
      userId: 'user-1',
      type: 'SYNC_FAILED',
      title: 'Sync failed',
      message: 'Provider sync failed',
    });

    expect(result).toBeNull();
  });
});
