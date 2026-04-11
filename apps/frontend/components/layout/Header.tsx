'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Menu,
  AlertTriangle,
  Bell,
  Building2,
  Search,
  Users,
  LogOut,
  Settings,
  CreditCard,
  Command,
  PenSquare,
} from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AUTH_ROUTES,
  getUserData,
  LOGOUT_MUTATION,
  logoutUser,
  type AuthUser,
} from '@/modules/auth';
import { InboxSwitcherModal } from './InboxSwitcherModal';
import {
  GET_MY_NOTIFICATIONS,
  GET_UNREAD_NOTIFICATION_COUNT,
  MARK_MY_NOTIFICATIONS_READ,
  MARK_NOTIFICATION_READ,
} from '@/lib/apollo/queries/notifications';
import {
  GET_MY_ACTIVE_WORKSPACE,
  GET_MY_WORKSPACES,
  SET_ACTIVE_WORKSPACE,
} from '@/lib/apollo/queries/workspaces';
import { GET_MY_MAILBOX_INBOUND_EVENT_STATS } from '@/lib/apollo/queries/mailbox-observability';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onToggleSidebar: () => void;
  onCompose?: () => void;
  onOpenCommandPalette?: () => void;
}

type DashboardNotification = {
  id: string;
  workspaceId?: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown> | string | null;
  createdAt: string;
};

type DashboardWorkspace = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
};

type MailboxInboundStatsSnapshot = {
  windowHours: number;
  totalCount: number;
  acceptedCount: number;
  deduplicatedCount: number;
  rejectedCount: number;
  successRatePercent: number;
  rejectionRatePercent: number;
  slaTargetSuccessPercent: number;
  slaWarningRejectedPercent: number;
  slaCriticalRejectedPercent: number;
  slaStatus: string;
  meetsSla: boolean;
  lastProcessedAt?: string | null;
};

type NotificationRealtimeEvent = {
  eventType: 'NOTIFICATION_CREATED' | 'NOTIFICATIONS_MARKED_READ';
  userId: string;
  workspaceId?: string | null;
  notificationId?: string;
  notificationType?: string;
  notificationTitle?: string;
  notificationMessage?: string;
  markedCount?: number;
  createdAtIso: string;
};

const resolveBackendBaseUrl = (): string => {
  const graphqlEndpoint =
    process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
  try {
    const parsedEndpoint = new URL(graphqlEndpoint);
    return `${parsedEndpoint.protocol}//${parsedEndpoint.host}`;
  } catch {
    return 'http://localhost:4000';
  }
};

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onCompose, onOpenCommandPalette }) => {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const [logout, { loading: logoutLoading }] = useMutation(LOGOUT_MUTATION, {
    onError: (e) => console.error('[Logout] GraphQL error', e),
  });

  const { data: notificationsData, refetch: refetchNotifications } = useQuery(
    GET_MY_NOTIFICATIONS,
    {
      variables: { limit: 8, unreadOnly: false, workspaceId: selectedWorkspaceId || undefined },
      fetchPolicy: 'cache-and-network',
      pollInterval: 30_000,
    },
  );
  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery(
    GET_UNREAD_NOTIFICATION_COUNT,
    {
      variables: { workspaceId: selectedWorkspaceId || undefined },
      fetchPolicy: 'cache-and-network',
      pollInterval: 30_000,
    },
  );
  const [markNotificationRead] = useMutation(MARK_NOTIFICATION_READ, {
    onError: (error) => console.error('[Notifications] markNotificationRead failed', error),
  });
  const [markMyNotificationsRead, { loading: markingAllNotificationsRead }] = useMutation(
    MARK_MY_NOTIFICATIONS_READ,
    { onError: (error) => console.error('[Notifications] markMyNotificationsRead failed', error) },
  );
  const { data: workspaceData } = useQuery(GET_MY_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 60_000,
  });
  const { data: activeWorkspaceData } = useQuery(GET_MY_ACTIVE_WORKSPACE, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 60_000,
  });
  const [setActiveWorkspace] = useMutation(SET_ACTIVE_WORKSPACE, {
    onError: (error) => console.error('[Workspace] setActiveWorkspace failed', error),
  });
  const { data: mailboxInboundStatsData, refetch: refetchMailboxInboundStats } = useQuery<{
    myMailboxInboundEventStats: MailboxInboundStatsSnapshot;
  }>(GET_MY_MAILBOX_INBOUND_EVENT_STATS, {
    variables: { windowHours: 24, workspaceId: selectedWorkspaceId || undefined },
    fetchPolicy: 'cache-and-network',
    pollInterval: 30_000,
  });

  useEffect(() => {
    const userData = getUserData();
    if (userData) setUser(userData);
  }, []);

  useEffect(() => {
    const storedWorkspaceId =
      typeof window !== 'undefined'
        ? localStorage.getItem('mailzen.selectedWorkspaceId')
        : null;
    if (storedWorkspaceId) setSelectedWorkspaceId(storedWorkspaceId);
  }, []);

  const getUserInitials = () => {
    if (!user?.name) return 'MZ';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('[Logout] failed', e);
    } finally {
      logoutUser();
      router.push(AUTH_ROUTES.login);
    }
  };

  const notifications = (notificationsData?.myNotifications || []) as DashboardNotification[];
  const unreadCount = Number(unreadCountData?.myUnreadNotificationCount || 0);
  const mailboxInboundStats = mailboxInboundStatsData?.myMailboxInboundEventStats;
  const mailboxInboundSlaStatus = mailboxInboundStats?.slaStatus || 'NO_DATA';
  const hasMailboxInboundErrors =
    mailboxInboundSlaStatus === 'WARNING' || mailboxInboundSlaStatus === 'CRITICAL';

  const workspaces = useMemo(
    () => (workspaceData?.myWorkspaces || []) as DashboardWorkspace[],
    [workspaceData?.myWorkspaces],
  );
  const backendActiveWorkspaceId = activeWorkspaceData?.myActiveWorkspace?.id as string | undefined;
  const resolvedWorkspace =
    workspaces.find((w) => w.id === selectedWorkspaceId) ||
    workspaces.find((w) => w.id === backendActiveWorkspaceId) ||
    workspaces[0];

  useEffect(() => {
    if (selectedWorkspaceId) return;
    const fallbackWorkspaceId = backendActiveWorkspaceId || workspaces[0]?.id;
    if (!fallbackWorkspaceId) return;
    setSelectedWorkspaceId(fallbackWorkspaceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mailzen.selectedWorkspaceId', fallbackWorkspaceId);
    }
  }, [selectedWorkspaceId, backendActiveWorkspaceId, workspaces]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const backendBaseUrl = resolveBackendBaseUrl();
    const streamUrl = new URL('/notifications/stream', backendBaseUrl);
    if (selectedWorkspaceId) streamUrl.searchParams.set('workspaceId', selectedWorkspaceId);
    const eventSource = new EventSource(streamUrl.toString(), { withCredentials: true });
    eventSource.onmessage = (event) => {
      if (!event.data) return;
      let parsedEvent: NotificationRealtimeEvent | null = null;
      try {
        parsedEvent = JSON.parse(event.data) as NotificationRealtimeEvent;
      } catch {
        return;
      }
      if (!parsedEvent || (parsedEvent.eventType !== 'NOTIFICATION_CREATED' && parsedEvent.eventType !== 'NOTIFICATIONS_MARKED_READ')) return;
      if (parsedEvent.eventType === 'NOTIFICATION_CREATED' && parsedEvent.notificationTitle) {
        toast({
          title: parsedEvent.notificationTitle,
          description: parsedEvent.notificationMessage || `Notification: ${parsedEvent.notificationType || 'NEW_EVENT'}`,
        });
      }
      void Promise.all([refetchNotifications(), refetchUnreadCount(), refetchMailboxInboundStats()]);
    };
    eventSource.onerror = () => {};
    return () => eventSource.close();
  }, [selectedWorkspaceId, refetchNotifications, refetchUnreadCount, refetchMailboxInboundStats, toast]);

  const handleNotificationClick = async (notification: DashboardNotification) => {
    if (notification.isRead) return;
    try {
      await markNotificationRead({ variables: { id: notification.id } });
      await Promise.all([refetchNotifications(), refetchUnreadCount()]);
    } catch (error) {
      console.error('[Notifications] click handler failed', error);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    await markMyNotificationsRead({ variables: { workspaceId: selectedWorkspaceId || undefined } });
    await Promise.all([refetchNotifications(), refetchUnreadCount()]);
  };

  const resolveNotificationMetadata = (notification: DashboardNotification): Record<string, unknown> => {
    const rawMetadata = notification.metadata;
    if (!rawMetadata) return {};
    if (typeof rawMetadata === 'string') {
      try {
        const parsed = JSON.parse(rawMetadata) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      } catch { return {}; }
      return {};
    }
    if (typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) return rawMetadata;
    return {};
  };

  const formatNotificationContext = (notification: DashboardNotification): string | null => {
    const metadata = resolveNotificationMetadata(notification);
    const workspaceId = typeof metadata.workspaceId === 'string' ? metadata.workspaceId : notification.workspaceId || null;
    const providerType = typeof metadata.providerType === 'string' ? metadata.providerType : null;
    const mailboxEmail = typeof metadata.mailboxEmail === 'string' ? metadata.mailboxEmail : null;
    const sourceIp = typeof metadata.sourceIp === 'string' && metadata.sourceIp !== '::1' && metadata.sourceIp !== '127.0.0.1' ? metadata.sourceIp : null;
    const slaStatus = typeof metadata.slaStatus === 'string' ? metadata.slaStatus : null;
    const successRatePercent = typeof metadata.successRatePercent === 'number' ? metadata.successRatePercent : null;
    const rejectionRatePercent = typeof metadata.rejectionRatePercent === 'number' ? metadata.rejectionRatePercent : null;
    const workspaceName = workspaceId && (workspaces.find((w) => w.id === workspaceId)?.name || workspaceId.slice(0, 8));
    const contextParts = [
      providerType ? `Provider: ${providerType}` : null,
      mailboxEmail ? `Mailbox: ${mailboxEmail}` : null,
      workspaceName ? `Workspace: ${workspaceName}` : null,
      sourceIp ? `Source IP: ${sourceIp}` : null,
      slaStatus ? `SLA: ${slaStatus}` : null,
      successRatePercent !== null ? `Success: ${successRatePercent}%` : null,
      rejectionRatePercent !== null ? `Reject: ${rejectionRatePercent}%` : null,
    ].filter(Boolean);
    if (!contextParts.length) return null;
    return contextParts.join(' · ');
  };

  const handleWorkspaceSelect = async (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    if (typeof window !== 'undefined') localStorage.setItem('mailzen.selectedWorkspaceId', workspaceId);
    await setActiveWorkspace({ variables: { workspaceId } });
  };

  return (
    <motion.header
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/70 backdrop-blur-2xl px-4 md:px-5"
      style={{
        boxShadow: '0 1px 0 hsl(var(--border) / 0.4), 0 4px 16px hsl(222 47% 5% / 0.06)',
      }}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left: mobile menu + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="hidden md:flex items-center gap-2 group">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white transition-all duration-200 group-hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 44%))',
              boxShadow: '0 2px 8px hsl(262 83% 58% / 0.3)',
            }}
          >
            M
          </div>
          <span
            className="hidden text-base font-semibold lg:inline-block"
            style={{
              fontFamily: 'var(--font-sora)',
              background: 'linear-gradient(135deg, hsl(262 83% 55%), hsl(var(--foreground)))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            MailZen
          </span>
        </Link>
      </div>

      {/* Center: search + compose */}
      <div className="flex flex-1 items-center justify-center gap-2 px-4">
        <div
          className={cn(
            'relative hidden md:flex items-center w-full transition-all duration-300 ease-out',
            searchFocused ? 'max-w-[440px]' : 'max-w-[320px]',
          )}
        >
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
          <input
            type="search"
            placeholder="Search emails, contacts..."
            className="h-9 w-full rounded-xl border border-border/50 bg-muted/40 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="absolute right-2.5 flex items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity"
            tabIndex={-1}
            aria-label="Open command palette"
          >
            <kbd className="flex h-5 items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 text-[10px] font-medium text-muted-foreground/70">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        {/* Quick compose */}
        <button
          type="button"
          onClick={onCompose}
          title="Compose new email (C)"
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <PenSquare className="h-4 w-4" />
        </button>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        {/* Workspace switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex h-8 gap-1.5 rounded-lg px-3 text-xs font-medium border border-border/40 hover:border-border/60 hover:bg-muted/60"
            >
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="max-w-[100px] truncate">{resolvedWorkspace?.name || 'Workspace'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-xl border border-border/60">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">No workspace found yet.</div>
            ) : (
              workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceSelect(workspace.id)}
                  className="rounded-lg"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate text-sm">{workspace.name}</span>
                    {workspace.id === resolvedWorkspace?.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" style={{ boxShadow: '0 0 6px hsl(262 83% 58% / 0.6)' }} />
                    )}
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings/workspaces')} className="rounded-lg">
              <Settings className="mr-2 h-3.5 w-3.5" />
              <span className="text-sm">Manage workspaces</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <InboxSwitcherModal />

        {/* AI sync status indicator */}
        <div
          title="AI Active — processing in background"
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg cursor-default"
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping"
              style={{ animationDuration: '3s' }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <>
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                    style={{ background: 'hsl(262 83% 58%)' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 animate-ping-slow rounded-full opacity-50"
                    style={{ background: 'hsl(262 83% 58% / 0.5)' }} />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-xl border border-border/60">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notifications
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start text-xs rounded-lg"
                disabled={unreadCount === 0 || markingAllNotificationsRead}
                onClick={() => { void handleMarkAllNotificationsRead(); }}
              >
                {markingAllNotificationsRead
                  ? 'Marking as read...'
                  : unreadCount > 0
                    ? `Mark all ${unreadCount > 99 ? '99+' : unreadCount} as read`
                    : 'No unread notifications'}
              </Button>
            </div>
            <DropdownMenuSeparator />
            {mailboxInboundStats && (
              <>
                <div className="px-2 py-2">
                  <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium">Mailbox health (24h)</span>
                      {hasMailboxInboundErrors ? (
                        <span className="flex items-center gap-1 text-destructive text-[11px]">
                          <AlertTriangle className="h-3 w-3" />
                          {mailboxInboundSlaStatus}
                        </span>
                      ) : (
                        <span className="text-emerald-500 text-[11px]">{mailboxInboundSlaStatus}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                      <span>Total: {mailboxInboundStats.totalCount}</span>
                      <span>Accepted: {mailboxInboundStats.acceptedCount}</span>
                      <span>Deduped: {mailboxInboundStats.deduplicatedCount}</span>
                      <span>Rejected: {mailboxInboundStats.rejectedCount}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Success {mailboxInboundStats.successRatePercent}% · Reject {mailboxInboundStats.rejectionRatePercent}%
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            {notifications.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>
            ) : (
              notifications.map((notification) => {
                const contextLabel = formatNotificationContext(notification);
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-medium">{notification.title}</span>
                      {!notification.isRead && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                    {contextLabel && <p className="text-[11px] text-muted-foreground/70">{contextLabel}</p>}
                    <span className="text-[11px] text-muted-foreground/60">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:shadow-md"
              style={{
                padding: '2px',
                background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(160 84% 39%))',
                boxShadow: '0 0 0 2px hsl(var(--background))',
              }}
            >
              <Avatar className="h-full w-full rounded-full">
                <AvatarImage src={user?.avatar || '/avatars/01.png'} alt={user?.name || 'User'} />
                <AvatarFallback
                  className="rounded-full text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 44%))' }}
                >
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border border-border/60">
            <DropdownMenuLabel className="font-semibold">{user?.name || 'My Account'}</DropdownMenuLabel>
            {user?.email && (
              <p className="px-2 pb-1 text-xs text-muted-foreground truncate">{user.email}</p>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/contacts')} className="rounded-lg">
              <Users className="mr-2 h-4 w-4" />
              <span>Contacts</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/smart-replies')} className="rounded-lg">
              <Settings className="mr-2 h-4 w-4" />
              <span>Smart Replies</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/notifications')} className="rounded-lg">
              <Bell className="mr-2 h-4 w-4" />
              <span>Notifications</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/billing')} className="rounded-lg">
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Billing</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/workspaces')} className="rounded-lg">
              <Building2 className="mr-2 h-4 w-4" />
              <span>Workspace</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{logoutLoading ? 'Logging out...' : 'Log out'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
};

export default Header;
