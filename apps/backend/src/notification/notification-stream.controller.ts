import {
  Controller,
  Logger,
  MessageEvent,
  Query,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationStreamController {
  private readonly logger = new Logger(NotificationStreamController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Sse('stream')
  streamNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('workspaceId') workspaceId?: string,
  ): Observable<MessageEvent> {
    const userId = String(req.user?.id || '').trim();
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    this.logger.log(
      `notification-stream: connected user=${userId} workspace=${workspaceId || 'all'}`,
    );
    const notificationEvents$ = this.notificationService
      .observeRealtimeEvents({
        userId,
        workspaceId: workspaceId || null,
      })
      .pipe(
        map(
          (event): MessageEvent => ({
            type: 'notification',
            data: event,
          }),
        ),
      );
    const heartbeat$ = interval(25_000).pipe(
      map(
        (): MessageEvent => ({
          type: 'heartbeat',
          data: {
            timestamp: new Date().toISOString(),
          },
        }),
      ),
    );
    return merge(notificationEvents$, heartbeat$);
  }
}
