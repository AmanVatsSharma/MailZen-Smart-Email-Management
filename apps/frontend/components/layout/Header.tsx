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
} from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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
  MARK_NOTIFICATION_READ,
} from '@/lib/apollo/queries/notifications';
import {
  GET_MY_ACTIVE_WORKSPACE,
  GET_MY_WORKSPACES,
  SET_ACTIVE_WORKSPACE,
} from '@/lib/apollo/queries/workspaces';
import { GET_MY_MAILBOX_INBOUND_EVENT_STATS } from '@/lib/apollo/queries/mailbox-observability';

interface HeaderProps {
  onToggleSidebar: () => void;
}

type DashboardNotification = {
  id: string;
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
  lastProcessedAt?: string | null;
};

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );

  const [logout, { loading: logoutLoading }] = useMutation(LOGOUT_MUTATION, {
    onError: (e) => {
      console.error('[Logout] GraphQL error', e);
    },
  });
  const { data: notificationsData, refetch: refetchNotifications } = useQuery(
    GET_MY_NOTIFICATIONS,
    {
      variables: { limit: 8, unreadOnly: false },
      fetchPolicy: 'cache-and-network',
      pollInterval: 30_000,
    },
  );
  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery(
    GET_UNREAD_NOTIFICATION_COUNT,
    {
      fetchPolicy: 'cache-and-network',
      pollInterval: 30_000,
    },
  );
  const [markNotificationRead] = useMutation(MARK_NOTIFICATION_READ, {
    onError: (error) => {
      console.error('[Notifications] markNotificationRead failed', error);
    },
  });
  const { data: workspaceData } = useQuery(GET_MY_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 60_000,
  });
  const { data: activeWorkspaceData } = useQuery(GET_MY_ACTIVE_WORKSPACE, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 60_000,
  });
  const [setActiveWorkspace] = useMutation(SET_ACTIVE_WORKSPACE, {
    onError: (error) => {
      console.error('[Workspace] setActiveWorkspace failed', error);
    },
  });
  const { data: mailboxInboundStatsData } = useQuery<{
    myMailboxInboundEventStats: MailboxInboundStatsSnapshot;
  }>(GET_MY_MAILBOX_INBOUND_EVENT_STATS, {
    variables: { windowHours: 24 },
    fetchPolicy: 'cache-and-network',
    pollInterval: 30_000,
  });

  useEffect(() => {
    // Try to get user data if available
    const userData = getUserData();
    if (userData) {
      setUser(userData);
    }
  }, []);

  useEffect(() => {
    const storedWorkspaceId =
      typeof window !== 'undefined'
        ? localStorage.getItem('mailzen.selectedWorkspaceId')
        : null;
    if (storedWorkspaceId) {
      setSelectedWorkspaceId(storedWorkspaceId);
    }
  }, []);

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user || !user.name) return 'MZ';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleLogout = async () => {
    try {
      console.warn('[Logout] starting');
      // Clears HttpOnly cookie on backend (session ends server-side).
      await logout();
    } catch (e) {
      // Even if backend logout fails, clear local cache and move user to login.
      console.error('[Logout] failed (continuing with local cleanup)', e);
    } finally {
      logoutUser();
      router.push(AUTH_ROUTES.login);
    }
  };

  const notifications = (notificationsData?.myNotifications ||
    []) as DashboardNotification[];
  const unreadCount = Number(unreadCountData?.myUnreadNotificationCount || 0);
  const mailboxInboundStats = mailboxInboundStatsData?.myMailboxInboundEventStats;
  const hasMailboxInboundErrors = Number(mailboxInboundStats?.rejectedCount || 0) > 0;
  const workspaces = useMemo(
    () => (workspaceData?.myWorkspaces || []) as DashboardWorkspace[],
    [workspaceData?.myWorkspaces],
  );
  const backendActiveWorkspaceId = activeWorkspaceData?.myActiveWorkspace?.id as
    | string
    | undefined;
  const resolvedWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ||
    workspaces.find((workspace) => workspace.id === backendActiveWorkspaceId) ||
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

  const handleNotificationClick = async (notification: DashboardNotification) => {
    if (notification.isRead) return;
    try {
      await markNotificationRead({ variables: { id: notification.id } });
      await Promise.all([refetchNotifications(), refetchUnreadCount()]);
    } catch (error) {
      console.error('[Notifications] click handler failed', error);
    }
  };

  const resolveNotificationMetadata = (
    notification: DashboardNotification,
  ): Record<string, unknown> => {
    const rawMetadata = notification.metadata;
    if (!rawMetadata) return {};
    if (typeof rawMetadata === 'string') {
      try {
        const parsed = JSON.parse(rawMetadata) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
      return {};
    }
    if (typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) {
      return rawMetadata;
    }
    return {};
  };

  const formatNotificationContext = (notification: DashboardNotification): string | null => {
    const metadata = resolveNotificationMetadata(notification);
    const workspaceId =
      typeof metadata.workspaceId === 'string' ? metadata.workspaceId : null;
    const providerType =
      typeof metadata.providerType === 'string' ? metadata.providerType : null;
    const mailboxEmail =
      typeof metadata.mailboxEmail === 'string' ? metadata.mailboxEmail : null;
    const sourceIp =
      typeof metadata.sourceIp === 'string' &&
      metadata.sourceIp !== '::1' &&
      metadata.sourceIp !== '127.0.0.1'
        ? metadata.sourceIp
        : null;

    const workspaceName =
      workspaceId &&
      (workspaces.find((workspace) => workspace.id === workspaceId)?.name ||
        workspaceId.slice(0, 8));
    const contextParts = [
      providerType ? `Provider: ${providerType}` : null,
      mailboxEmail ? `Mailbox: ${mailboxEmail}` : null,
      workspaceName ? `Workspace: ${workspaceName}` : null,
      sourceIp ? `Source IP: ${sourceIp}` : null,
    ].filter(Boolean);
    if (!contextParts.length) return null;
    return contextParts.join(' · ');
  };

  const handleWorkspaceSelect = async (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mailzen.selectedWorkspaceId', workspaceId);
    }
    await setActiveWorkspace({
      variables: { workspaceId },
    });
  };

  return (
    <motion.header 
      // Premium glass header: slightly more blur to feel “native”.
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/65 backdrop-blur-xl px-4 md:px-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5,
        type: "spring",
        stiffness: 100,
        damping: 15
      }}
    >
      <div className="flex items-center gap-2 lg:gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleSidebar}
          className="lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-6 w-6" />
        </motion.button>
        <motion.div 
          className="hidden md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/" className="flex items-center gap-2">
            <motion.div 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-primary to-purple-600 text-white font-bold"
              whileHover={{ 
                scale: 1.05,
                boxShadow: "0 0 15px rgba(124, 58, 237, 0.5)"
              }}
            >
              M
            </motion.div>
            <motion.span 
              className="hidden text-xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent lg:inline-block"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              MailZen
            </motion.span>
          </Link>
        </motion.div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          {/* Avoid animating width to prevent layout shift; keep subtle fade/scale instead. */}
          <motion.input
            type="search"
            placeholder="Search..."
            className="rounded-full bg-background border border-input h-9 w-[200px] lg:w-[300px] pl-8 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            whileFocus={{ boxShadow: "0 0 0 3px rgba(124, 58, 237, 0.2)" }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.35 }}
          />
        </div>

        <motion.div 
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="hidden md:inline-flex">
                <Building2 className="mr-2 h-4 w-4" />
                {resolvedWorkspace?.name || 'Workspace'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Workspace switcher</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  No workspace found yet.
                </div>
              ) : (
                workspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    onClick={() => handleWorkspaceSelect(workspace.id)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="truncate">{workspace.name}</span>
                      {workspace.id === resolvedWorkspace?.id && (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings/workspaces')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Manage workspaces</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <InboxSwitcherModal />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {mailboxInboundStats && (
                <>
                  <div className="px-2 py-2">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium">Mailbox inbound health (24h)</span>
                        {hasMailboxInboundErrors ? (
                          <span className="flex items-center text-destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Attention
                          </span>
                        ) : (
                          <span className="text-emerald-600">Healthy</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                        <span>Total: {mailboxInboundStats.totalCount}</span>
                        <span>Accepted: {mailboxInboundStats.acceptedCount}</span>
                        <span>Deduped: {mailboxInboundStats.deduplicatedCount}</span>
                        <span>Rejected: {mailboxInboundStats.rejectedCount}</span>
                      </div>
                      {mailboxInboundStats.lastProcessedAt && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Last event:{' '}
                          {new Date(mailboxInboundStats.lastProcessedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              {notifications.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground">
                  You&apos;re all caught up.
                </div>
              ) : (
                notifications.map((notification) => {
                  const contextLabel = formatNotificationContext(notification);
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex cursor-pointer flex-col items-start gap-1 py-2"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-medium">{notification.title}</span>
                        {!notification.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                      {contextLabel && (
                        <p className="text-[11px] text-muted-foreground/80">
                          {contextLabel}
                        </p>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar || "/avatars/01.png"} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-linear-to-br from-primary to-purple-600 text-white">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user?.name || "My Account"}</DropdownMenuLabel>
              {user?.email && (
                <p className="px-2 py-1 text-xs text-muted-foreground truncate">{user.email}</p>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/contacts')}>
                <Users className="mr-2 h-4 w-4" />
                <span>Contacts</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings/smart-replies')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Smart Replies Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings/notifications')}>
                <Bell className="mr-2 h-4 w-4" />
                <span>Notification Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings/billing')}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Billing Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings/workspaces')}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>Workspace Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{logoutLoading ? 'Logging out...' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>
    </motion.header>
  );
};

export default Header;
