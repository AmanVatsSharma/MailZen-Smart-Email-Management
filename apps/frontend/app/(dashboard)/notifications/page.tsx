'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Bell, CheckCircle, CheckCheck } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GET_MY_NOTIFICATIONS,
  GET_UNREAD_NOTIFICATION_COUNT,
  MARK_MY_NOTIFICATIONS_READ,
  MARK_NOTIFICATION_READ,
} from '@/lib/apollo/queries/notifications';
import { GET_MY_WORKSPACES } from '@/lib/apollo/queries/workspaces';
import {
  formatNotificationContext,
  formatNotificationTypeLabel,
  getNotificationTypeBadgeColor,
  type NotificationForContext,
  type WorkspaceForContext,
} from '@/lib/notifications/notification-context-formatter';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/tokens/cn';

const NOTIFICATION_TYPES = [
  { value: 'ALL', label: 'All types' },
  { value: 'HIGH_PRIORITY_EMAIL', label: 'High Priority' },
  { value: 'SYNC_FAILURE', label: 'Sync Failures' },
  { value: 'MAILBOX_INBOUND_SLA_WARNING', label: 'SLA Warning' },
  { value: 'MAILBOX_INBOUND_SLA_CRITICAL', label: 'SLA Critical' },
];

const TIME_WINDOWS = [
  { value: '24', label: 'Last 24 hours' },
  { value: '48', label: 'Last 48 hours' },
  { value: '168', label: 'Last 7 days' },
  { value: '720', label: 'Last 30 days' },
];

function NotificationCard({
  notification,
  workspaces,
  onMarkRead,
}: {
  notification: NotificationForContext;
  workspaces: WorkspaceForContext[];
  onMarkRead: (id: string) => void;
}) {
  const contextLabel = formatNotificationContext(notification, workspaces);
  const typeLabel = formatNotificationTypeLabel(notification.type);
  const badgeColor = getNotificationTypeBadgeColor(notification.type);

  return (
    <div
      className={cn(
        'group flex gap-3 rounded-xl border p-4 transition-all duration-200',
        notification.isRead
          ? 'border-border/40 bg-background/40'
          : 'border-border/60 bg-muted/20',
      )}
    >
      <div className="mt-0.5 flex-shrink-0">
        {notification.isRead ? (
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        ) : (
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: 'hsl(262 83% 58%)' }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground leading-tight">
              {notification.title}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] h-4 font-medium',
                badgeColor,
              )}
            >
              {typeLabel}
            </span>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground/70 whitespace-nowrap">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{notification.message}</p>

        {contextLabel && (
          <p className="text-[11px] text-muted-foreground/60">{contextLabel}</p>
        )}
      </div>

      {!notification.isRead && (
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => onMarkRead(notification.id)}
          >
            <CheckCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-border/40 p-4">
          <Skeleton className="mt-1 h-2 w-2 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sinceHours, setSinceHours] = useState('168');
  const [limit, setLimit] = useState(25);

  const typesVar = typeFilter !== 'ALL' ? [typeFilter] : undefined;

  const { data, loading, refetch } = useQuery(GET_MY_NOTIFICATIONS, {
    variables: {
      limit,
      unreadOnly,
      sinceHours: parseInt(sinceHours, 10),
      types: typesVar,
    },
    fetchPolicy: 'cache-and-network',
  });

  const { data: unreadData, refetch: refetchUnread } = useQuery(GET_UNREAD_NOTIFICATION_COUNT, {
    fetchPolicy: 'cache-and-network',
  });

  const { data: workspacesData } = useQuery(GET_MY_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
  });

  const [markRead] = useMutation(MARK_NOTIFICATION_READ, {
    onCompleted: () => { void refetch(); void refetchUnread(); },
  });

  const [markAllRead, { loading: markingAll }] = useMutation(MARK_MY_NOTIFICATIONS_READ, {
    onCompleted: () => { void refetch(); void refetchUnread(); },
  });

  const notifications = (data?.myNotifications ?? []) as NotificationForContext[];
  const workspaces = (workspacesData?.myWorkspaces ?? []) as WorkspaceForContext[];
  const unreadCount = Number(unreadData?.myUnreadNotificationCount ?? 0);
  const hasMore = notifications.length === limit;

  const handleMarkRead = (id: string) => {
    void markRead({ variables: { id } });
  };

  const handleMarkAllRead = () => {
    void markAllRead({ variables: { sinceHours: parseInt(sinceHours, 10), types: typesVar } });
  };

  return (
    <DashboardPageShell
      title="Notification Center"
      description="Browse all notifications, alerts, and AI-triggered events"
      actions={
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={unreadCount === 0 || markingAll}
          onClick={handleMarkAllRead}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          {markingAll ? 'Marking read...' : `Mark all read${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-44 text-xs border-border/50">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {NOTIFICATION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sinceHours} onValueChange={setSinceHours}>
          <SelectTrigger className="h-8 w-36 text-xs border-border/50">
            <SelectValue placeholder="Time window" />
          </SelectTrigger>
          <SelectContent>
            {TIME_WINDOWS.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="unread-only"
            checked={unreadOnly}
            onCheckedChange={setUnreadOnly}
            className="h-4 w-7 data-[state=checked]:bg-primary"
          />
          <Label htmlFor="unread-only" className="text-xs text-muted-foreground cursor-pointer">
            Unread only
          </Label>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Notification list */}
      {loading && notifications.length === 0 ? (
        <NotificationsSkeleton />
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'hsl(262 83% 58% / 0.1)' }}
          >
            <Bell className="h-6 w-6" style={{ color: 'hsl(262 83% 58%)' }} />
          </div>
          <p className="text-sm font-medium text-foreground">All caught up</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No notifications match the current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              workspaces={workspaces}
              onMarkRead={handleMarkRead}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setLimit((l) => l + 25)}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </DashboardPageShell>
  );
}
