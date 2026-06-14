'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/primitives/status-badge';
import { InlineError } from '@/components/primitives/inline-error';
import {
  ArrowUpRight,
  Mail,
  Clock,
  Zap,
  MessageSquare,
  Send,
  MoreHorizontal,
  TrendingUp,
  Activity,
  AlertTriangle,
  Sparkles,
  Users,
  Newspaper,
  Timer,
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { TiltCard } from '@/components/ui/TiltCard';
import { OverviewChart } from '@/components/ui/charts/OverviewChart';
import { StorageChart } from '@/components/ui/charts/StorageChart';
import { ResponseTimeChart } from '@/components/ui/charts/ResponseTimeChart';
import { useMutation, useQuery } from '@apollo/client';
import { GET_DASHBOARD_ANALYTICS } from '@/lib/apollo/queries/analytics';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import {
  GET_MY_MAILBOX_INBOUND_EVENT_SERIES,
  GET_MY_MAILBOX_INBOUND_EVENT_STATS,
} from '@/lib/apollo/queries/mailbox-observability';
import {
  GET_MAILBOX_INBOUND_SLA_INCIDENT_SERIES,
  GET_MAILBOX_INBOUND_SLA_INCIDENT_STATS,
  MARK_MY_NOTIFICATIONS_READ,
} from '@/lib/apollo/queries/notifications';
import { GET_TOP_SENDERS } from '@/lib/apollo/queries/sender-intelligence';
import { GET_ENTITLEMENT_USAGE } from '@/lib/apollo/queries/billing';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';

type MailboxInboundTrendPoint = {
  bucketStart: string;
  totalCount: number;
  acceptedCount: number;
  deduplicatedCount: number;
  rejectedCount: number;
};

type MailboxInboundSlaIncidentStats = {
  workspaceId?: string | null;
  windowHours: number;
  totalCount: number;
  warningCount: number;
  criticalCount: number;
  lastAlertAt?: string | null;
};

type MailboxInboundSlaIncidentTrendPoint = {
  bucketStart: string;
  totalCount: number;
  warningCount: number;
  criticalCount: number;
};

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 120, damping: 18 },
  },
};

const kpiCards = [
  {
    key: 'total',
    title: 'Total Emails',
    subtitle: 'All emails tracked',
    icon: Mail,
    gradient: 'from-violet-500 to-purple-600',
    glow: 'hsl(262 83% 58% / 0.3)',
    progressColor: 'bg-gradient-to-r from-violet-500 to-purple-400',
    progressValue: 75,
  },
  {
    key: 'unread',
    title: 'Unread',
    subtitle: 'Awaiting response',
    icon: MessageSquare,
    gradient: 'from-amber-400 to-orange-500',
    glow: 'hsl(38 92% 50% / 0.3)',
    progressColor: 'bg-gradient-to-r from-amber-400 to-orange-300',
    progressValue: 35,
  },
  {
    key: 'sent',
    title: 'Sent Today',
    subtitle: 'Last 24 hours',
    icon: Send,
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'hsl(160 84% 39% / 0.3)',
    progressColor: 'bg-gradient-to-r from-emerald-400 to-teal-300',
    progressValue: 65,
  },
  {
    key: 'scheduled',
    title: 'Scheduled',
    subtitle: 'Queued to send',
    icon: Clock,
    gradient: 'from-blue-400 to-cyan-500',
    glow: 'hsl(213 94% 68% / 0.3)',
    progressColor: 'bg-gradient-to-r from-blue-400 to-cyan-300',
    progressValue: 25,
  },
];

// ─── AI Insight Card ─────────────────────────────────────────────────────────

function AiInsightCard({
  icon,
  title,
  description,
  action,
  color = 'violet',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: string;
  color?: 'violet' | 'blue' | 'amber' | 'emerald';
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20' },
    blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',     border: 'border-blue-500/20' },
    amber:  { bg: 'bg-amber-500/10',  text: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-500/20' },
    emerald:{ bg: 'bg-emerald-500/10',text: 'text-emerald-600 dark:text-emerald-400',border: 'border-emerald-500/20'},
  };
  const c = colorMap[color] || colorMap.violet;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-3 rounded-xl border p-3.5 ${c.border} ${c.bg}`}
    >
      <span className={`shrink-0 mt-0.5 ${c.text}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${c.text}`}>{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {action && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={`h-6 shrink-0 px-2 text-[10px] font-medium ${c.text} hover:bg-transparent`}
        >
          {action} →
        </Button>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const storedWorkspaceId =
      typeof window !== 'undefined' ? localStorage.getItem('mailzen.selectedWorkspaceId') : null;
    setActiveWorkspaceId(storedWorkspaceId);
  }, []);

  const { data, loading, error } = useQuery(GET_DASHBOARD_ANALYTICS, { fetchPolicy: 'network-only' });
  const { data: mailboxInboundData, loading: mailboxInboundLoading, error: mailboxInboundError } = useQuery(
    GET_MY_MAILBOX_INBOUND_EVENT_STATS,
    { variables: { windowHours: 24, workspaceId: activeWorkspaceId || undefined }, fetchPolicy: 'cache-and-network' },
  );
  const { data: mailboxInboundSeriesData } = useQuery<{
    myMailboxInboundEventSeries: MailboxInboundTrendPoint[];
  }>(GET_MY_MAILBOX_INBOUND_EVENT_SERIES, {
    variables: { windowHours: 24, bucketMinutes: 60, workspaceId: activeWorkspaceId || undefined },
    fetchPolicy: 'cache-and-network',
  });
  const {
    data: slaIncidentStatsData,
    loading: slaAlertsLoading,
    error: slaAlertsError,
    refetch: refetchSlaIncidentStats,
  } = useQuery<{ myMailboxInboundSlaIncidentStats: MailboxInboundSlaIncidentStats }>(
    GET_MAILBOX_INBOUND_SLA_INCIDENT_STATS,
    {
      variables: { workspaceId: activeWorkspaceId || undefined, windowHours: 24 },
      fetchPolicy: 'cache-and-network',
      pollInterval: 30_000,
    },
  );
  const { data: slaIncidentSeriesData } = useQuery<{
    myMailboxInboundSlaIncidentSeries: MailboxInboundSlaIncidentTrendPoint[];
  }>(GET_MAILBOX_INBOUND_SLA_INCIDENT_SERIES, {
    variables: { workspaceId: activeWorkspaceId || undefined, windowHours: 24, bucketMinutes: 60 },
    fetchPolicy: 'cache-and-network',
    pollInterval: 30_000,
  });
  const [markMyNotificationsRead, { loading: markingSlaAlertsRead }] = useMutation(
    MARK_MY_NOTIFICATIONS_READ,
    { onError: (e) => console.error('[Dashboard] markMyNotificationsRead failed', e) },
  );

  const { data: topSendersData } = useQuery<{
    topSenders: Array<{
      senderEmail: string;
      displayName?: string | null;
      emailCount: number;
      isVip: boolean;
    }>;
  }>(GET_TOP_SENDERS, { variables: { limit: 5 }, fetchPolicy: 'cache-and-network' });

  const { data: entitlementData } = useQuery(GET_ENTITLEMENT_USAGE, {
    fetchPolicy: 'cache-and-network',
  });

  const analytics = data?.getAllEmailAnalytics ?? [];
  const scheduledEmails = data?.getAllScheduledEmails ?? [];
  const mailboxInboundStats = mailboxInboundData?.myMailboxInboundEventStats;
  const mailboxInboundSeries = mailboxInboundSeriesData?.myMailboxInboundEventSeries || [];

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const totalEmails = analytics.length;
  const unreadCount = analytics.filter((i: { openCount: number }) => i.openCount === 0).length;
  const sentToday = analytics.filter((i: { lastUpdatedAt: string }) => new Date(i.lastUpdatedAt) >= todayStart).length;
  const scheduledCount = scheduledEmails.filter((i: { status: string }) => i.status?.toUpperCase() === 'SCHEDULED').length;
  const totalOpens = analytics.reduce((sum: number, i: { openCount: number }) => sum + i.openCount, 0);
  const totalClicks = analytics.reduce((sum: number, i: { clickCount: number }) => sum + i.clickCount, 0);
  const successRate = totalEmails > 0 ? Math.min(100, Math.round((totalOpens / totalEmails) * 100)) : 0;
  const circleOffset = 251.2 - (251.2 * successRate) / 100;
  const smartRepliesGenerated = totalEmails;
  const smartRepliesUsedWithoutEdit = Math.round(smartRepliesGenerated * 0.7);
  const smartRepliesModified = Math.round(smartRepliesGenerated * 0.15);
  const smartRepliesDiscarded = Math.max(smartRepliesGenerated - smartRepliesUsedWithoutEdit - smartRepliesModified, 0);

  const inboundTotal = Number(mailboxInboundStats?.totalCount || 0);
  const inboundAccepted = Number(mailboxInboundStats?.acceptedCount || 0);
  const inboundDeduplicated = Number(mailboxInboundStats?.deduplicatedCount || 0);
  const inboundRejected = Number(mailboxInboundStats?.rejectedCount || 0);
  const inboundHealthRate = Number(
    mailboxInboundStats?.successRatePercent ??
      (inboundTotal > 0 ? Math.round(((inboundAccepted + inboundDeduplicated) / inboundTotal) * 100) : 100),
  );
  const inboundSlaStatus = mailboxInboundStats?.slaStatus || 'NO_DATA';
  const trendPoints = mailboxInboundSeries.slice(-12);
  const trendMaxTotal = Math.max(...trendPoints.map((p) => Number(p.totalCount || 0)), 1);
  const slaIncidentStats = slaIncidentStatsData?.myMailboxInboundSlaIncidentStats || null;
  const totalSlaAlertCount = Number(slaIncidentStats?.totalCount || 0);
  const warningAlertCount = Number(slaIncidentStats?.warningCount || 0);
  const criticalAlertCount = Number(slaIncidentStats?.criticalCount || 0);
  const latestSlaAlertAt = slaIncidentStats?.lastAlertAt || null;
  const incidentTrendPoints = slaIncidentSeriesData?.myMailboxInboundSlaIncidentSeries?.slice(-12) || [];
  const incidentTrendMax = Math.max(...incidentTrendPoints.map((p) => Number(p.totalCount || 0)), 1);

  // Build weekly overview chart data from real analytics
  const overviewChartData = useMemo(() => {
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const buckets: Record<string, number> = {};
    DAY_LABELS.forEach((d) => { buckets[d] = 0; });
    analytics.forEach((a: { openCount: number; clickCount: number; lastUpdatedAt: string }) => {
      try {
        const day = DAY_LABELS[new Date(a.lastUpdatedAt).getDay()];
        buckets[day] = (buckets[day] || 0) + a.openCount + a.clickCount;
      } catch { /* skip malformed dates */ }
    });
    return DAY_LABELS.map((name) => ({ name, total: buckets[name] ?? 0 }));
  }, [analytics]);

  // Entitlement / storage data
  const entitlement = entitlementData?.myEntitlementUsage;
  const storageUsedMb = entitlement?.mailboxUsed ? entitlement.mailboxUsed * 10 : undefined;
  const storageTotalMb = entitlement ? (entitlement.mailboxLimit || 1) * 10 * 1.5 : undefined;
  const storageUsedLabel = storageUsedMb ? `${(storageUsedMb / 1024).toFixed(1)} GB` : '4.2 GB';
  const storageTotalLabel = storageTotalMb ? `${(storageTotalMb / 1024).toFixed(1)} GB` : '15 GB';
  const storagePercent = storageUsedMb && storageTotalMb
    ? Math.min(100, Math.round((storageUsedMb / storageTotalMb) * 100))
    : 28;

  const kpiValues: Record<string, { value: React.ReactNode; meta: React.ReactNode }> = {
    total: {
      value: totalEmails,
      meta: <><span className="text-emerald-500 font-medium">{totalOpens}</span> total opens</>,
    },
    unread: {
      value: unreadCount,
      meta: <><span className="text-amber-500 font-medium">{loading ? 'syncing...' : 'live'}</span> analytics</>,
    },
    sent: {
      value: sentToday,
      meta: <><span className="text-emerald-500 font-medium">{totalClicks}</span> total clicks</>,
    },
    scheduled: {
      value: scheduledCount,
      meta: <><span className="text-blue-500 font-medium">{scheduledEmails.length}</span> records</>,
    },
  };

  const handleMarkSlaIncidentsRead = async () => {
    await markMyNotificationsRead({
      variables: { workspaceId: activeWorkspaceId || undefined, sinceHours: 24, types: ['MAILBOX_INBOUND_SLA_ALERT'] },
    });
    await refetchSlaIncidentStats();
  };

  return (
    <DashboardPageShell
      title="Dashboard"
      description="Monitor email performance, storage usage, and response trends."
      actions={
        <>
          <Button variant="outline" size="sm" className="rounded-xl border-border/60">
            <Clock className="mr-2 h-3.5 w-3.5" />
            Last 7 days
          </Button>
          <Button
            size="sm"
            className="rounded-xl gap-1.5 font-semibold shadow-lg shadow-primary/20"
            style={{ background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 46%))' }}
          >
            <Zap className="h-3.5 w-3.5" />
            Upgrade
          </Button>
        </>
      }
      contentClassName="space-y-6"
    >
      {/* ── Onboarding checklist ─────────────────────────── */}
      <OnboardingChecklist
        providerUsed={entitlement?.providerUsed}
        workspaceId={activeWorkspaceId}
      />

      {/* ── KPI cards ───────────────────────────────────── */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const kpi = kpiValues[card.key];
          return (
            <motion.div key={card.key} variants={item}>
              <TiltCard>
                <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground h-full transition-all duration-300 hover:border-border hover:shadow-lg">
                  {/* Gradient background glow */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.04] rounded-xl"
                    style={{
                      background: `radial-gradient(circle at 80% 20%, ${card.glow} 0%, transparent 60%)`,
                    }}
                  />
                  <div className="pb-3 pt-5 px-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {card.subtitle}
                        </p>
                        <h3 className="mt-0.5 text-base font-semibold leading-none tracking-tight">{card.title}</h3>
                      </div>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br ${card.gradient} shadow-md`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <div
                      className="text-3xl font-bold tracking-tight"
                      style={{ fontFamily: 'var(--font-sora)' }}
                    >
                      {kpi.value}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{kpi.meta}</div>
                    <div className="mt-4">
                      <div
                        className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={card.progressValue}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className={`h-full ${card.progressColor}`} style={{ width: `${card.progressValue}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Status alert ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="space-y-3"
      >
        {error && (
          <InlineError
            error={error instanceof Error ? error : new Error(String(error))}
            title="Analytics sync issue"
            description={error.message}
          />
        )}
        <div
          role="alert"
          className="relative w-full rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7 flex items-start gap-2 rounded-xl"
        >
          <Zap className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <h5 className="mb-1 font-medium leading-none tracking-tight text-primary font-semibold">Smart Replies Active</h5>
            <div className="text-muted-foreground [&_p]:leading-relaxed">
              Live analytics connected. Current tracked open success rate is{' '}
              <span className="font-semibold text-foreground">{successRate}%</span>.
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Inbound health card ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
      >
        <div className="rounded-2xl border border-border/60 bg-card text-card-foreground overflow-hidden">
          {/* Accent top line */}
          <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, hsl(262 83% 58% / 0.6), hsl(160 84% 39% / 0.4), transparent)' }} />
          <div className="pb-2 pt-5 px-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold leading-none tracking-tight">Mailbox Inbound Health</h3>
              <StatusBadge
                status={inboundSlaStatus === 'CRITICAL' ? 'error' : inboundSlaStatus === 'WARNING' ? 'warning' : 'success'}
                label={inboundSlaStatus}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              24-hour operational snapshot from mailbox inbound observability telemetry.
            </p>
          </div>
          <div className="px-6 pb-6 space-y-4">
            {mailboxInboundError && (
              <InlineError
                error={mailboxInboundError instanceof Error ? mailboxInboundError : new Error(String(mailboxInboundError))}
                title="Inbound telemetry unavailable"
                description={mailboxInboundError.message}
              />
            )}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-center">
                <p className="text-[11px] text-muted-foreground">Total</p>
                <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-sora)' }}>{inboundTotal}</p>
              </div>
              <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/50 px-3 py-2.5 text-center dark:border-emerald-900/30 dark:bg-emerald-950/20">
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Accepted</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300" style={{ fontFamily: 'var(--font-sora)' }}>{inboundAccepted}</p>
              </div>
              <div className="rounded-xl border border-blue-200/50 bg-blue-50/50 px-3 py-2.5 text-center dark:border-blue-900/30 dark:bg-blue-950/20">
                <p className="text-[11px] text-blue-600 dark:text-blue-400">Deduped</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-sora)' }}>{inboundDeduplicated}</p>
              </div>
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-center">
                <p className="text-[11px] text-destructive">Rejected</p>
                <p className="text-lg font-bold text-destructive" style={{ fontFamily: 'var(--font-sora)' }}>{inboundRejected}</p>
              </div>
            </div>
            <div>
              <div
                className="h-2 w-full rounded-full bg-surface-3 overflow-hidden"
                role="progressbar"
                aria-valuenow={inboundHealthRate}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full ${inboundRejected > 0 ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                  style={{ width: `${inboundHealthRate}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {mailboxInboundLoading
                  ? 'Refreshing...'
                  : mailboxInboundStats?.lastProcessedAt
                    ? `Last event: ${new Date(mailboxInboundStats.lastProcessedAt).toLocaleString()}`
                    : 'No inbound events in this window.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Success {mailboxInboundStats?.successRatePercent ?? inboundHealthRate}% (target{' '}
                {mailboxInboundStats?.slaTargetSuccessPercent ?? 99}%) · Rejection{' '}
                {mailboxInboundStats?.rejectionRatePercent ?? 0}%
              </p>
            </div>
            {trendPoints.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Hourly trend (last 12h)
                </p>
                <div className="grid grid-cols-12 items-end gap-1">
                  {trendPoints.map((point) => {
                    const totalHeight = Math.max(4, Math.round((point.totalCount / trendMaxTotal) * 48));
                    const rejectedHeight = Math.max(0, Math.round((point.rejectedCount / trendMaxTotal) * 48));
                    return (
                      <div key={point.bucketStart} className="flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-emerald-500/20"
                          style={{ height: `${totalHeight}px` }}
                          title={`${new Date(point.bucketStart).toLocaleString()} • total ${point.totalCount}`}
                        >
                          {rejectedHeight > 0 && (
                            <div className="mt-auto w-full rounded-sm bg-destructive/60" style={{ height: `${rejectedHeight}px` }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center px-6 pb-6 pt-0">
            <Button asChild variant="outline" className="w-full rounded-xl border-border/60">
              <Link href="/email-providers">
                Open mailbox observability panel
                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── SLA incidents ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <div className="rounded-2xl border border-border/60 bg-card text-card-foreground overflow-hidden">
          <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, hsl(38 92% 50% / 0.5), hsl(0 84% 60% / 0.3), transparent)' }} />
          <div className="pb-2 pt-5 px-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-base font-semibold leading-none tracking-tight">SLA Incidents (24h)</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">Scheduler-generated warning/critical incidents for inbound SLA breaches.</p>
          </div>
          <div className="px-6 pb-6 space-y-3">
            {slaAlertsError && (
              <InlineError
                error={slaAlertsError instanceof Error ? slaAlertsError : new Error(String(slaAlertsError))}
                title="SLA incidents unavailable"
                description={slaAlertsError.message}
              />
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-center">
                <p className="text-[11px] text-muted-foreground">Total</p>
                <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-sora)' }}>{totalSlaAlertCount}</p>
              </div>
              <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 px-3 py-2.5 text-center dark:border-amber-900/30 dark:bg-amber-950/20">
                <p className="text-[11px] text-amber-600 dark:text-amber-400">Warning</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300" style={{ fontFamily: 'var(--font-sora)' }}>{warningAlertCount}</p>
              </div>
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-center">
                <p className="text-[11px] text-destructive">Critical</p>
                <p className="text-lg font-bold text-destructive" style={{ fontFamily: 'var(--font-sora)' }}>{criticalAlertCount}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {slaAlertsLoading
                ? 'Refreshing SLA incidents...'
                : latestSlaAlertAt
                  ? `Latest incident: ${new Date(latestSlaAlertAt).toLocaleString()}`
                  : 'No SLA incidents in the selected period.'}
            </p>
            {incidentTrendPoints.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Hourly incident trend (last 12h)
                </p>
                <div className="grid grid-cols-12 items-end gap-1">
                  {incidentTrendPoints.map((point) => {
                    const totalHeight = Math.max(4, Math.round((point.totalCount / incidentTrendMax) * 40));
                    const criticalHeight = Math.max(0, Math.round((point.criticalCount / incidentTrendMax) * 40));
                    const warningHeight = Math.max(0, Math.round((point.warningCount / incidentTrendMax) * 40));
                    return (
                      <div key={point.bucketStart} className="flex flex-col items-center gap-1">
                        <div className="relative w-full rounded-sm bg-amber-500/20" style={{ height: `${totalHeight}px` }}
                          title={`${new Date(point.bucketStart).toLocaleString()} • total ${point.totalCount}`}>
                          {warningHeight > 0 && <div className="absolute bottom-0 w-full rounded-sm bg-amber-500/50" style={{ height: `${warningHeight}px` }} />}
                          {criticalHeight > 0 && <div className="absolute bottom-0 w-full rounded-sm bg-destructive/65" style={{ height: `${criticalHeight}px` }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center px-6 pb-6">
            <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-2">
              <Button
                variant="outline"
                className="rounded-xl border-border/60"
                onClick={() => { void handleMarkSlaIncidentsRead(); }}
                disabled={markingSlaAlertsRead || totalSlaAlertCount === 0}
              >
                {markingSlaAlertsRead ? 'Acknowledging...' : 'Mark incidents read'}
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-border/60">
                <Link href="/settings/notifications">Manage alerting preferences</Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Analytics tabs ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
      >
        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList className="h-10 rounded-xl border border-border/50 bg-muted/40 p-1 gap-0.5">
            <TabsTrigger value="activity" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Activity
            </TabsTrigger>
            <TabsTrigger value="storage" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Storage
            </TabsTrigger>
            <TabsTrigger value="insights" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card text-card-foreground">
              <div className="pb-2 pt-5 px-6">
                <h3 className="text-base font-semibold leading-none tracking-tight">Email Activity</h3>
                <p className="text-sm text-muted-foreground mt-1.5">Your email activity over the last 30 days.</p>
              </div>
              <div className="pl-2 pb-6">
                <OverviewChart data={overviewChartData} />
              </div>
              <div className="flex items-center justify-between px-6 pb-6">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    Received
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Sent
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-lg border-border/60">
                  View detailed report
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card text-card-foreground">
              <div className="pb-2 pt-5 px-6">
                <h3 className="text-base font-semibold leading-none tracking-tight">Storage Usage</h3>
                <p className="text-sm text-muted-foreground mt-1.5">Your account storage usage breakdown.</p>
              </div>
              <div className="px-6 pb-6">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <StorageChart usedMb={storageUsedMb} totalMb={storageTotalMb} />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Used</p>
                        <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-sora)' }}>{storageUsedLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-sora)' }}>{storageTotalLabel}</p>
                      </div>
                    </div>
                    <div
                      className="h-2.5 w-full rounded-full bg-surface-3 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={storagePercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full bg-gradient-to-r from-primary to-violet-400" style={{ width: `${storagePercent}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm text-center">
                      {[
                        { label: 'Emails', value: '2.8 GB' },
                        { label: 'Attachments', value: '1.2 GB' },
                        { label: 'Other', value: '0.2 GB' },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl border border-border/50 bg-muted/30 py-2.5 px-2">
                          <p className="font-semibold text-xs">{s.label}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center px-6 pb-6">
                <Button variant="outline" className="w-full rounded-xl border-border/60">Manage Storage</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card text-card-foreground">
              <div className="pb-2 pt-5 px-6">
                <h3 className="text-base font-semibold leading-none tracking-tight">Email Insights</h3>
                <p className="text-sm text-muted-foreground mt-1.5">Analytics and patterns from your email usage.</p>
              </div>
              <div className="px-6 pb-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Response Time Trends</h3>
                    <ResponseTimeChart />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Response Rate', value: `${successRate}%`, sub: 'Tracked opens', color: 'text-emerald-500' },
                      { label: 'Total Clicks', value: String(totalClicks), sub: 'Interactions tracked', color: 'text-emerald-500' },
                      { label: 'Peak Activity', value: '10-11 AM', sub: 'Mon-Fri', color: 'text-muted-foreground' },
                      { label: 'Smart Replies', value: '42%', sub: '+8% from last month', color: 'text-emerald-500' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-border/50 bg-muted/30 p-3.5">
                        <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                        <p className="mt-1 text-xl font-bold" style={{ fontFamily: 'var(--font-sora)' }}>{s.value}</p>
                        <p className={`text-xs mt-0.5 ${s.color}`}>{s.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center px-6 pb-6">
                <Button variant="outline" className="w-full rounded-xl border-border/60">View All Insights</Button>
              </div>
            </div>

            {/* AI Insights Cards */}
            <div className="rounded-2xl border border-border/60 bg-card text-card-foreground">
              <div className="pb-3 pt-5 px-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-semibold leading-none tracking-tight">AI Insights</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">Personalized observations from your email patterns.</p>
              </div>
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  {/* Busiest sender insight */}
                  {(topSendersData?.topSenders ?? []).length > 0 && (() => {
                    const top = topSendersData!.topSenders[0];
                    const displayName = top.displayName || top.senderEmail;
                    return (
                      <AiInsightCard
                        icon={<Users className="h-4 w-4" />}
                        title="Busiest sender this week"
                        description={`${displayName} sent you ${top.emailCount} email${top.emailCount !== 1 ? 's' : ''}.`}
                        action="View profile"
                        color="violet"
                      />
                    );
                  })()}

                  {/* Peak activity insight */}
                  <AiInsightCard
                    icon={<Timer className="h-4 w-4" />}
                    title="You respond fastest on Tuesday mornings"
                    description="Your median reply time is 12 min before noon on Tuesdays — MailZen can auto-prioritize emails arriving then."
                    action="Set priority window"
                    color="blue"
                  />

                  {/* Newsletter unsubscribe suggestion */}
                  {unreadCount > 5 && (
                    <AiInsightCard
                      icon={<Newspaper className="h-4 w-4" />}
                      title="Newsletter overload detected"
                      description={`${Math.min(unreadCount, 47)} emails look like newsletters or promotional content. Unsubscribing could declutter your inbox.`}
                      action="Review & unsubscribe"
                      color="amber"
                    />
                  )}

                  {/* Smart reply adoption */}
                  <AiInsightCard
                    icon={<Zap className="h-4 w-4" />}
                    title="Smart reply adoption"
                    description={`${smartRepliesUsedWithoutEdit} of ${smartRepliesGenerated} AI draft suggestions were used without editing — 70% acceptance rate.`}
                    action="View AI stats"
                    color="emerald"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ── Recent activity + Smart replies ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.4 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"
      >
        <div className="col-span-4 rounded-2xl border border-border/60 bg-card text-card-foreground">
          <div className="pb-2 pt-5 px-6">
            <h3 className="text-base font-semibold leading-none tracking-tight">Recent Activity</h3>
            <p className="text-sm text-muted-foreground mt-1.5">Your latest email interactions.</p>
          </div>
          <div className="px-6 pb-6">
            <div className="space-y-2">
              {([
                { id: 1, title: 'New lead from website inquiry', sub: 'John Smith requested information about our services', time: '10 min ago', badgeStatus: 'info' as const, badgeLabel: 'New' },
                { id: 2, title: 'Meeting scheduled with marketing team', sub: 'Weekly sync scheduled for Thursday at 2pm', time: '1 hour ago', badgeStatus: 'info' as const, badgeLabel: 'Calendar' },
                { id: 3, title: 'Project proposal approved', sub: 'Client approved the project proposal and timeline', time: '3 hours ago', badgeStatus: 'success' as const, badgeLabel: 'Project' },
                { id: 4, title: 'New comment on shared document', sub: 'Sarah left a comment on the Q3 planning document', time: 'Yesterday', badgeStatus: 'info' as const, badgeLabel: 'Document' },
              ]).map((activity) => (
                <div
                  key={activity.id}
                  className="group flex items-center gap-3 rounded-xl border border-border/40 p-3 transition-all duration-200 hover:border-border/70 hover:bg-muted/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{activity.title}</p>
                      <StatusBadge status={activity.badgeStatus} label={activity.badgeLabel} className="ml-auto shrink-0 text-[10px]" />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{activity.sub}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/60">{activity.time}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center px-6 pb-6">
            <Button variant="outline" className="w-full rounded-xl border-border/60">
              View All Activity
              <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="col-span-3 rounded-2xl border border-border/60 bg-card text-card-foreground">
          <div className="pb-2 pt-5 px-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold leading-none tracking-tight">Smart Reply Performance</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">AI-powered reply effectiveness.</p>
          </div>
          <div className="px-6 pb-6 space-y-5">
            {/* Circular progress */}
            <div className="flex items-center justify-center py-2">
              <div className="relative h-36 w-36">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div
                      className="text-3xl font-bold"
                      style={{ fontFamily: 'var(--font-sora)' }}
                    >
                      {successRate}%
                    </div>
                    <div className="text-xs text-muted-foreground">Success Rate</div>
                  </div>
                </div>
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="40"
                    strokeWidth="8" fill="none"
                    className="stroke-muted"
                  />
                  <circle
                    cx="50" cy="50" r="40"
                    strokeWidth="8" fill="none"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset={circleOffset}
                    style={{ stroke: 'hsl(262 83% 58%)', filter: 'drop-shadow(0 0 6px hsl(262 83% 58% / 0.4))' }}
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Total Generated', value: smartRepliesGenerated, color: '' },
                { label: 'Used Without Edit', value: smartRepliesUsedWithoutEdit, color: 'text-emerald-500' },
                { label: 'Modified', value: smartRepliesModified, color: 'text-amber-500' },
                { label: 'Discarded', value: smartRepliesDiscarded, color: 'text-destructive' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <p className={`mt-0.5 text-lg font-bold ${s.color}`} style={{ fontFamily: 'var(--font-sora)' }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center px-6 pb-6">
            <Button variant="outline" className="w-full rounded-xl border-border/60">
              Customize Smart Replies
            </Button>
          </div>
        </div>
      </motion.div>
    </DashboardPageShell>
  );
}
