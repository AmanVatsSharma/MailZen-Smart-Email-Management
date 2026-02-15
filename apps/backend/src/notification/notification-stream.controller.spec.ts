import { UnauthorizedException } from '@nestjs/common';
import { firstValueFrom, of, take } from 'rxjs';
import { NotificationStreamController } from './notification-stream.controller';
import { NotificationService } from './notification.service';

describe('NotificationStreamController', () => {
  const notificationService = {
    observeRealtimeEvents: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<NotificationService, 'observeRealtimeEvents'>
  >;

  const controller = new NotificationStreamController(
    notificationService as unknown as NotificationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('streams notification events for authenticated users', async () => {
    notificationService.observeRealtimeEvents.mockReturnValue(
      of({
        eventType: 'NOTIFICATION_CREATED',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        notificationId: 'notif-1',
        notificationType: 'SYNC_FAILED',
        createdAtIso: new Date('2026-02-16T03:00:00.000Z').toISOString(),
      }),
    );

    const event = await firstValueFrom(
      controller
        .streamNotifications(
          {
            user: {
              id: 'user-1',
            },
          } as never,
          'workspace-1',
        )
        .pipe(take(1)),
    );

    expect(notificationService.observeRealtimeEvents).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
    expect(event.type).toBe('notification');
    expect(event.data).toEqual(
      expect.objectContaining({
        eventType: 'NOTIFICATION_CREATED',
        notificationId: 'notif-1',
      }),
    );
  });

  it('throws when request user is missing', () => {
    expect(() => controller.streamNotifications({ user: {} } as never)).toThrow(
      UnauthorizedException,
    );
  });
});
