import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateNotificationPreferencesInput } from './dto/update-notification-preferences.input';
import {
  MailboxInboundSlaIncidentStatsResponse,
  MailboxInboundSlaIncidentTrendPointResponse,
} from './dto/mailbox-inbound-sla-incident-stats.response';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
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
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
    @Args('sinceHours', { type: () => Int, nullable: true })
    sinceHours?: number,
    @Args('types', { type: () => [String], nullable: true }) types?: string[],
  ) {
    return this.notificationService.listNotificationsForUser({
      userId: ctx.req.user.id,
      limit: limit ?? 20,
      unreadOnly: unreadOnly ?? false,
      workspaceId: workspaceId || null,
      sinceHours: sinceHours ?? null,
      types: types || [],
    });
  }

  @Query(() => Int, {
    description: 'Unread notification count for current user',
  })
  async myUnreadNotificationCount(
    @Context() ctx: RequestContext,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
  ) {
    return this.notificationService.getUnreadCount(
      ctx.req.user.id,
      workspaceId || null,
    );
  }

  @Query(() => MailboxInboundSlaIncidentStatsResponse, {
    description:
      'Mailbox inbound SLA alert incident stats for current user over a rolling window',
  })
  async myMailboxInboundSlaIncidentStats(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Context() ctx: RequestContext,
  ) {
    return this.notificationService.getMailboxInboundSlaIncidentStats({
      userId: ctx.req.user.id,
      workspaceId,
      windowHours,
    });
  }

  @Query(() => [MailboxInboundSlaIncidentTrendPointResponse], {
    description:
      'Mailbox inbound SLA alert trend buckets for current user over a rolling window',
  })
  async myMailboxInboundSlaIncidentSeries(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes: number,
    @Context() ctx: RequestContext,
  ) {
    return this.notificationService.getMailboxInboundSlaIncidentSeries({
      userId: ctx.req.user.id,
      workspaceId,
      windowHours,
      bucketMinutes,
    });
  }

  @Query(() => UserNotificationPreference, {
    description: 'Notification preferences for current user',
  })
  async myNotificationPreferences(@Context() ctx: RequestContext) {
    return this.notificationService.getOrCreatePreferences(ctx.req.user.id);
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

  @Mutation(() => Int, {
    description:
      'Mark notifications as read for current user with optional filters',
  })
  async markMyNotificationsRead(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Context() ctx: RequestContext,
    @Args('sinceHours', { type: () => Int, nullable: true })
    sinceHours: number,
    @Args('types', { type: () => [String], nullable: true }) types: string[],
  ) {
    return this.notificationService.markNotificationsRead({
      userId: ctx.req.user.id,
      workspaceId: workspaceId || null,
      sinceHours: sinceHours ?? null,
      types: types || [],
    });
  }

  @Mutation(() => UserNotificationPreference, {
    description: 'Update notification preferences',
  })
  async updateMyNotificationPreferences(
    @Args('input') input: UpdateNotificationPreferencesInput,
    @Context() ctx: RequestContext,
  ) {
    return this.notificationService.updatePreferences(ctx.req.user.id, input);
  }
}
