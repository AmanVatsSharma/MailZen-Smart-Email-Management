import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationService } from './notification.service';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => UserNotification)
@UseGuards(JwtAuthGuard)
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  @Query(() => [UserNotification], {
    description: 'List notifications for current user',
  })
  async myNotifications(
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Args('unreadOnly', { type: () => Boolean, nullable: true })
    unreadOnly: boolean,
    @Context() ctx: RequestContext,
  ) {
    return this.notificationService.listNotificationsForUser({
      userId: ctx.req.user.id,
      limit: limit ?? 20,
      unreadOnly: unreadOnly ?? false,
    });
  }

  @Query(() => Int, {
    description: 'Unread notification count for current user',
  })
  async myUnreadNotificationCount(@Context() ctx: RequestContext) {
    return this.notificationService.getUnreadCount(ctx.req.user.id);
  }

  @Mutation(() => UserNotification, {
    description: 'Mark a notification as read',
  })
  async markNotificationRead(
    @Args('id') id: string,
    @Context() ctx: RequestContext,
  ) {
    return this.notificationService.markNotificationRead(id, ctx.req.user.id);
  }
}
