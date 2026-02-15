'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight,
  Mail,
  Clock,
  Zap,
  MessageSquare,
  Send,
  MoreHorizontal,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, Variants } from 'framer-motion';
import { TiltCard } from '@/components/ui/TiltCard';
import { OverviewChart } from '@/components/ui/charts/OverviewChart';
import { StorageChart } from '@/components/ui/charts/StorageChart';
import { ResponseTimeChart } from '@/components/ui/charts/ResponseTimeChart';
import { useQuery } from '@apollo/client';
import { GET_DASHBOARD_ANALYTICS } from '@/lib/apollo/queries/analytics';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import {
  GET_MY_MAILBOX_INBOUND_EVENT_SERIES,
  GET_MY_MAILBOX_INBOUND_EVENT_STATS,
} from '@/lib/apollo/queries/mailbox-observability';
import { GET_MY_NOTIFICATIONS } from '@/lib/apollo/queries/notifications';

type MailboxInboundTrendPoint = {
  bucketStart: string;
  totalCount: number;
  acceptedCount: number;
  deduplicatedCount: number;
  rejectedCount: number;
};

type DashboardNotification = {
  id: string;
  workspaceId?: string | null;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | string | null;
  isRead: boolean;
  createdAt: string;
};

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  },
};

export default function DashboardPage() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const storedWorkspaceId =
      typeof window !== 'undefined'
        ? localStorage.getItem('mailzen.selectedWorkspaceId')
        : null;
    setActiveWorkspaceId(storedWorkspaceId);
  }, []);

  const { data, loading, error } = useQuery(GET_DASHBOARD_ANALYTICS, {
    fetchPolicy: 'network-only',
  });
  const {
    data: mailboxInboundData,
    loading: mailboxInboundLoading,
    error: mailboxInboundError,
  } = useQuery(GET_MY_MAILBOX_INBOUND_EVENT_STATS, {
    variables: {
      windowHours: 24,
      workspaceId: activeWorkspaceId || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });
  const { data: mailboxInboundSeriesData } = useQuery<{
    myMailboxInboundEventSeries: MailboxInboundTrendPoint[];
  }>(GET_MY_MAILBOX_INBOUND_EVENT_SERIES, {
    variables: {
      windowHours: 24,
      bucketMinutes: 60,
      workspaceId: activeWorkspaceId || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });
  const {
    data: slaAlertsData,
    loading: slaAlertsLoading,
    error: slaAlertsError,
  } = useQuery<{ myNotifications: DashboardNotification[] }>(
    GET_MY_NOTIFICATIONS,
    {
      variables: {
        limit: 10,
        unreadOnly: false,
        workspaceId: activeWorkspaceId || undefined,
        sinceHours: 24,
        types: ['MAILBOX_INBOUND_SLA_ALERT'],
      },
      fetchPolicy: 'cache-and-network',
      pollInterval: 30_000,
    },
  );

  const analytics = data?.getAllEmailAnalytics ?? [];
  const scheduledEmails = data?.getAllScheduledEmails ?? [];
  const mailboxInboundStats = mailboxInboundData?.myMailboxInboundEventStats;
  const mailboxInboundSeries =
    mailboxInboundSeriesData?.myMailboxInboundEventSeries || [];

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const totalEmails = analytics.length;
  const unreadCount = analytics.filter((item: { openCount: number }) => item.openCount === 0).length;
  const sentToday = analytics.filter(
    (item: { lastUpdatedAt: string }) => new Date(item.lastUpdatedAt) >= todayStart,
  ).length;
  const scheduledCount = scheduledEmails.filter(
    (item: { status: string }) => item.status?.toUpperCase() === 'SCHEDULED',
  ).length;

  const totalOpens = analytics.reduce(
    (sum: number, item: { openCount: number }) => sum + item.openCount,
    0,
  );
  const totalClicks = analytics.reduce(
    (sum: number, item: { clickCount: number }) => sum + item.clickCount,
    0,
  );
  const successRate = totalEmails > 0 ? Math.min(100, Math.round((totalOpens / totalEmails) * 100)) : 0;
  const circleOffset = 251.2 - (251.2 * successRate) / 100;
  const smartRepliesGenerated = totalEmails;
  const smartRepliesUsedWithoutEdit = Math.round(smartRepliesGenerated * 0.7);
  const smartRepliesModified = Math.round(smartRepliesGenerated * 0.15);
  const smartRepliesDiscarded = Math.max(
    smartRepliesGenerated - smartRepliesUsedWithoutEdit - smartRepliesModified,
    0,
  );
  const inboundTotal = Number(mailboxInboundStats?.totalCount || 0);
  const inboundAccepted = Number(mailboxInboundStats?.acceptedCount || 0);
  const inboundDeduplicated = Number(mailboxInboundStats?.deduplicatedCount || 0);
  const inboundRejected = Number(mailboxInboundStats?.rejectedCount || 0);
  const inboundHealthRate = Number(
    mailboxInboundStats?.successRatePercent ??
      (inboundTotal > 0
        ? Math.round(((inboundAccepted + inboundDeduplicated) / inboundTotal) * 100)
        : 100),
  );
  const inboundSlaStatus = mailboxInboundStats?.slaStatus || 'NO_DATA';
  const trendPoints = mailboxInboundSeries.slice(-12);
  const trendMaxTotal = Math.max(
    ...trendPoints.map((point) => Number(point.totalCount || 0)),
    1,
  );
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
        return {};
      } catch {
        return {};
      }
    }
    if (typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) {
      return rawMetadata as Record<string, unknown>;
    }
    return {};
  };
  const slaAlertNotifications = slaAlertsData?.myNotifications || [];
  const criticalAlertCount = slaAlertNotifications.filter((notification) => {
    const payload = resolveNotificationMetadata(notification);
    return String(payload.slaStatus || '').toUpperCase() === 'CRITICAL';
  }).length;
  const warningAlertCount = Math.max(
    slaAlertNotifications.length - criticalAlertCount,
    0,
  );
  const latestSlaAlert = slaAlertNotifications[0];

  return (
    <DashboardPageShell
      title="Dashboard"
      titleClassName="text-3xl font-bold tracking-tight"
      description="Monitor email performance, storage usage, and response trends."
      actions={(
        <>
          <Button variant="outline" size="sm">
            <Clock className="mr-2 h-4 w-4" />
            Last 7 days
          </Button>
          <Button variant="premium" size="sm">
            <Zap className="mr-2 h-4 w-4" />
            Upgrade
          </Button>
        </>
      )}
      contentClassName="space-y-8"
    >
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-4"
      >
        <motion.div 
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item}>
            <TiltCard>
              <Card className="overflow-hidden h-full border-l-4 border-l-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle>Total Emails</CardTitle>
                  <CardDescription>All emails in your account</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalEmails}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-emerald-500 font-medium">{totalOpens}</span> total opens tracked
                  </div>
                  <div className="mt-4 h-1">
                    <Progress value={75} className="h-2" />
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Mail className="h-12 w-12 text-primary" />
                </div>
              </Card>
            </TiltCard>
          </motion.div>

          <motion.div variants={item}>
            <TiltCard>
              <Card className="overflow-hidden h-full border-l-4 border-l-amber-500/50">
                <CardHeader className="pb-2">
                  <CardTitle>Unread</CardTitle>
                  <CardDescription>Emails waiting for response</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{unreadCount}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-amber-500 font-medium">{loading ? 'syncing...' : 'live'}</span>{' '}
                    from analytics resolver
                  </div>
                  <div className="mt-4 h-1">
                    <Progress value={35} className="h-2" indicatorColor="bg-linear-to-r from-amber-500 to-amber-300" />
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <MessageSquare className="h-12 w-12 text-amber-500" />
                </div>
              </Card>
            </TiltCard>
          </motion.div>

          <motion.div variants={item}>
            <TiltCard>
              <Card className="overflow-hidden h-full border-l-4 border-l-emerald-500/50">
                <CardHeader className="pb-2">
                  <CardTitle>Sent Today</CardTitle>
                  <CardDescription>Emails sent in last 24h</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{sentToday}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-emerald-500 font-medium">{totalClicks}</span> total clicks tracked
                  </div>
                  <div className="mt-4 h-1">
                    <Progress value={65} className="h-2" indicatorColor="bg-linear-to-r from-emerald-500 to-emerald-300" />
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Send className="h-12 w-12 text-emerald-500" />
                </div>
              </Card>
            </TiltCard>
          </motion.div>

          <motion.div variants={item}>
            <TiltCard>
              <Card className="overflow-hidden h-full border-l-4 border-l-blue-500/50">
                <CardHeader className="pb-2">
                  <CardTitle>Scheduled</CardTitle>
                  <CardDescription>Emails waiting to be sent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{scheduledCount}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-blue-500 font-medium">{scheduledEmails.length}</span> scheduled records
                  </div>
                  <div className="mt-4 h-1">
                    <Progress value={25} className="h-2" indicatorColor="bg-linear-to-r from-blue-500 to-blue-300" />
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Clock className="h-12 w-12 text-blue-500" />
                </div>
              </Card>
            </TiltCard>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertTitle>Analytics sync issue</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <Alert className="bg-linear-to-r from-primary/10 to-primary/5 border-primary/20">
          <Zap className="h-4 w-4 text-primary" />
          <AlertTitle>Smart Replies Active</AlertTitle>
          <AlertDescription>
            Live analytics connected. Current tracked open success rate is {successRate}%.
          </AlertDescription>
        </Alert>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Mailbox inbound health (24h)</CardTitle>
            <CardDescription>
              Operational snapshot from mailbox inbound observability telemetry.
              {activeWorkspaceId
                ? ' Scoped to your active workspace.'
                : ' Aggregated across all workspaces.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mailboxInboundError && (
              <Alert variant="destructive">
                <AlertTitle>Inbound telemetry unavailable</AlertTitle>
                <AlertDescription>{mailboxInboundError.message}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Badge variant="outline">Total: {inboundTotal}</Badge>
              <Badge
                variant="outline"
                className="border-emerald-200/60 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              >
                Accepted: {inboundAccepted}
              </Badge>
              <Badge
                variant="outline"
                className="border-blue-200/60 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200"
              >
                Deduped: {inboundDeduplicated}
              </Badge>
              <Badge
                variant="outline"
                className="border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15"
              >
                Rejected: {inboundRejected}
              </Badge>
              <Badge
                variant="outline"
                className={
                  inboundSlaStatus === 'CRITICAL'
                    ? 'border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15'
                    : inboundSlaStatus === 'WARNING'
                      ? 'border-amber-200/60 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200'
                      : 'border-emerald-200/60 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                }
              >
                SLA: {inboundSlaStatus}
              </Badge>
            </div>
            <div>
              <Progress
                value={inboundHealthRate}
                className="h-2"
                indicatorColor={
                  inboundRejected > 0
                    ? 'bg-linear-to-r from-amber-500 to-red-500'
                    : 'bg-linear-to-r from-emerald-500 to-emerald-300'
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {mailboxInboundLoading
                  ? 'Refreshing inbound telemetry...'
                  : mailboxInboundStats?.lastProcessedAt
                    ? `Last inbound event: ${new Date(mailboxInboundStats.lastProcessedAt).toLocaleString()}`
                    : 'No inbound mailbox events tracked yet for this window.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Success {mailboxInboundStats?.successRatePercent ?? inboundHealthRate}% (target{' '}
                {mailboxInboundStats?.slaTargetSuccessPercent ?? 99}%) · Rejection{' '}
                {mailboxInboundStats?.rejectionRatePercent ?? 0}% (warn{' '}
                {mailboxInboundStats?.slaWarningRejectedPercent ?? 1}% / critical{' '}
                {mailboxInboundStats?.slaCriticalRejectedPercent ?? 5}%)
              </p>
            </div>
            {trendPoints.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Hourly trend (last 12 buckets)
                </p>
                <div className="grid grid-cols-12 items-end gap-1">
                  {trendPoints.map((point) => {
                    const totalHeight = Math.max(
                      4,
                      Math.round((point.totalCount / trendMaxTotal) * 48),
                    );
                    const rejectedHeight = Math.max(
                      0,
                      Math.round((point.rejectedCount / trendMaxTotal) * 48),
                    );
                    return (
                      <div key={point.bucketStart} className="flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-emerald-500/25"
                          style={{ height: `${totalHeight}px` }}
                          title={`${new Date(point.bucketStart).toLocaleString()} • total ${point.totalCount}`}
                        >
                          {rejectedHeight > 0 && (
                            <div
                              className="mt-auto w-full rounded-sm bg-destructive/70"
                              style={{ height: `${rejectedHeight}px` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/email-providers">Open mailbox observability panel</Link>
            </Button>
          </CardFooter>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Mailbox inbound SLA incidents (24h)</CardTitle>
            <CardDescription>
              Scheduler-generated warning/critical incidents for inbound SLA breaches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {slaAlertsError && (
              <Alert variant="destructive">
                <AlertTitle>SLA incidents unavailable</AlertTitle>
                <AlertDescription>{slaAlertsError.message}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Badge variant="outline">Total: {slaAlertNotifications.length}</Badge>
              <Badge
                variant="outline"
                className="border-amber-200/60 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
              >
                Warning: {warningAlertCount}
              </Badge>
              <Badge
                variant="outline"
                className="border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15"
              >
                Critical: {criticalAlertCount}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {slaAlertsLoading
                ? 'Refreshing SLA incidents...'
                : latestSlaAlert
                  ? `Latest incident: ${new Date(latestSlaAlert.createdAt).toLocaleString()}`
                  : 'No SLA incidents detected in the selected period.'}
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/settings/notifications">Manage SLA alerting preferences</Link>
            </Button>
          </CardFooter>
        </Card>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList className="bg-background/50 backdrop-blur-sm">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Activity</CardTitle>
                <CardDescription>Your email activity over the last 30 days.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <OverviewChart />
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <div className="mr-1 size-3 rounded-full bg-primary"></div>
                    Received
                  </div>
                  <div className="flex items-center">
                    <div className="mr-1 size-3 rounded-full bg-blue-500"></div>
                    Sent
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View detailed report
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="storage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Usage</CardTitle>
                <CardDescription>Your account storage usage.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <StorageChart />
                  <div className="space-y-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Used Storage</p>
                        <p className="text-2xl font-bold">4.2 GB</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-sm font-medium">Total Storage</p>
                        <p className="text-2xl font-bold">15 GB</p>
                      </div>
                    </div>
                    <Progress value={28} className="h-3" />
                    <div className="mt-2 grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <p className="font-medium">Emails</p>
                        <p>2.8 GB</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">Attachments</p>
                        <p>1.2 GB</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">Other</p>
                        <p>0.2 GB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  Manage Storage
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Insights</CardTitle>
                <CardDescription>Analytics and patterns from your email usage.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Response Time Trends</h3>
                    <ResponseTimeChart />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 rounded-lg border p-4 bg-card/50">
                      <div className="text-sm font-medium text-muted-foreground">Response Rate</div>
                      <div className="text-2xl font-bold">{successRate}%</div>
                      <div className="text-xs text-emerald-500">Derived from tracked opens</div>
                    </div>
                    <div className="space-y-2 rounded-lg border p-4 bg-card/50">
                      <div className="text-sm font-medium text-muted-foreground">Total Clicks</div>
                      <div className="text-2xl font-bold">{totalClicks}</div>
                      <div className="text-xs text-emerald-500">Engagement interactions tracked</div>
                    </div>
                    <div className="space-y-2 rounded-lg border p-4 bg-card/50">
                      <div className="text-sm font-medium text-muted-foreground">Peak Activity</div>
                      <div className="text-2xl font-bold">10-11 AM</div>
                      <div className="text-xs text-muted-foreground">Monday-Friday</div>
                    </div>
                    <div className="space-y-2 rounded-lg border p-4 bg-card/50">
                      <div className="text-sm font-medium text-muted-foreground">Smart Replies Used</div>
                      <div className="text-2xl font-bold">42%</div>
                      <div className="text-xs text-emerald-500">+8% from last month</div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  View All Insights
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"
      >
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent email activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 * i, duration: 0.3 }}
                  className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="shrink-0">
                    <div className="size-10 rounded-full bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">
                        {i === 1 && "New lead from website inquiry"}
                        {i === 2 && "Meeting scheduled with marketing team"}
                        {i === 3 && "Project proposal approved"}
                        {i === 4 && "New comment on shared document"}
                      </div>
                      <Badge variant="outline" className="ml-auto shrink-0">
                        {i === 1 && "New"}
                        {i === 2 && "Calendar"}
                        {i === 3 && "Project"}
                        {i === 4 && "Document"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {i === 1 && "John Smith requested information about our services"}
                      {i === 2 && "Weekly marketing sync scheduled for Thursday at 2pm"}
                      {i === 3 && "Client approved the project proposal and timeline"}
                      {i === 4 && "Sarah left a comment on the Q3 planning document"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {i === 1 && "10 minutes ago"}
                      {i === 2 && "1 hour ago"}
                      {i === 3 && "3 hours ago"}
                      {i === 4 && "Yesterday at 4:23 PM"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              View All Activity
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Smart Reply Performance</CardTitle>
            <CardDescription>How your AI-powered replies are performing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex items-center justify-center py-4">
              <div className="relative h-40 w-40">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{successRate}%</div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                </div>
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <circle
                    className="stroke-slate-200 dark:stroke-slate-800"
                    cx="50"
                    cy="50"
                    r="40"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    className="stroke-primary"
                    cx="50"
                    cy="50"
                    r="40"
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset={circleOffset}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Total Generated</div>
                <div className="text-xl font-bold">{smartRepliesGenerated}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Used Without Edit</div>
                <div className="text-xl font-bold">{smartRepliesUsedWithoutEdit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Modified</div>
                <div className="text-xl font-bold">{smartRepliesModified}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Discarded</div>
                <div className="text-xl font-bold">{smartRepliesDiscarded}</div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              Customize Smart Replies
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </DashboardPageShell>
  );
}
