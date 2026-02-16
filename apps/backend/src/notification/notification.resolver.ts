import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationDataExportResponse } from './dto/notification-data-export.response';
import { NotificationRetentionPurgeResponse } from './dto/notification-retention-purge.response';
import { RegisterNotificationPushSubscriptionInput } from './dto/register-notification-push-subscription.input';
import { UpdateNotificationPreferencesInput } from './dto/update-notification-preferences.input';
import { MailboxInboundSlaIncidentDataExportResponse } from './dto/mailbox-inbound-sla-incident-data-export.response';
import {
  MailboxInboundSlaIncidentStatsResponse,
  MailboxInboundSlaIncidentTrendPointResponse,
} from './dto/mailbox-inbound-sla-incident-stats.response';
import { NotificationPushSubscription } from './entities/notification-push-subscription.entity';
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

  @Query(() => MailboxInboundSlaIncidentDataExportResponse, {
    description:
      'Export mailbox inbound SLA alert incident analytics for current user as JSON payload',
  })
  async myMailboxInboundSlaIncidentDataExport(
    @Args('workspaceId', { nullable: true }) workspaceId: string,
    @Args('windowHours', { type: () => Int, nullable: true })
    windowHours: number,
    @Args('bucketMinutes', { type: () => Int, nullable: true })
    bucketMinutes: number,
    @Context() ctx: RequestContext,
  ) {
    return this.notificationService.exportMailboxInboundSlaIncidentData({
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

  @Query(() => [NotificationPushSubscription], {
    description: 'Push subscriptions for current user',
  })
  async myNotificationPushSubscriptions(
    @Context() ctx: RequestContext,
    @Args('workspaceId', { nullable: true }) workspaceId?: string,
  ) {
    return this.notificationService.listPushSubscriptionsForUser({
      userId: ctx.req.user.id,
      workspaceId: workspaceId || null,
    });
  }

  @Query(() => NotificationDataExportResponse, {
    description: 'Export notification preferences and history for current user',
  })
  async myNotificationDataExport(
    @Context() ctx: RequestContext,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.notificationService.exportNotificationData({
      userId: ctx.req.user.id,
      limit,
    });
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

  @Mutation(() => NotificationPushSubscription, {
    description: 'Register or refresh current user push subscription',
  })
  async registerMyNotificationPushSubscription(
    @Args('input') input: RegisterNotificationPushSubscriptionInput,
    @Context() ctx: RequestContext,
  ) {
    return this.notificationService.registerPushSubscription({
      userId: ctx.req.user.id,
      payload: input,
    });
  }

  @Mutation(() => Boolean, {
    description: 'Deactivate push subscription for current user',
  })
  async unregisterMyNotificationPushSubscription(
    @Args('endpoint') endpoint: string,
    @Context() ctx: RequestContext,
  ) {
    return this.notificationService.unregisterPushSubscription({
      userId: ctx.req.user.id,
      endpoint,
    });
  }

  @Mutation(() => NotificationRetentionPurgeResponse, {
    description:
      'Purge expired notification data using configured retention policy',
  })
  @UseGuards(AdminGuard)
  async purgeNotificationRetentionData(
    @Args('notificationRetentionDays', { type: () => Int, nullable: true })
    notificationRetentionDays?: number,
    @Args('disabledPushRetentionDays', { type: () => Int, nullable: true })
    disabledPushRetentionDays?: number,
  ) {
    return this.notificationService.purgeNotificationRetentionData({
      notificationRetentionDays,
      disabledPushRetentionDays,
    });
  }
}
