'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import {
  Eye,
  MousePointerClick,
  BarChart2,
  Clock,
  TrendingUp,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GET_EMAIL_TRACKING_STATS } from '@/lib/apollo/queries/analytics';
import { formatDistanceToNow } from 'date-fns';

interface EmailAnalyticsRow {
  id: string;
  emailId: string;
  openCount: number;
  clickCount: number;
  lastUpdatedAt: string;
}

interface EmailTrackingPanelProps {
  /** Optional emailId to show tracking for a specific sent email */
  emailId?: string | null;
  className?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'emerald' | 'amber' | 'purple';
}) {
  const accentClasses = {
    blue: 'text-blue-500 bg-blue-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    amber: 'text-amber-500 bg-amber-500/10',
    purple: 'text-violet-500 bg-violet-500/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/60 p-3"
    >
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', accentClasses[accent ?? 'blue'])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </motion.div>
  );
}

export function EmailTrackingPanel({ emailId, className }: EmailTrackingPanelProps) {
  const trackingEnabled = process.env.NEXT_PUBLIC_ENABLE_EMAIL_TRACKING === 'true';

  const { data, loading } = useQuery<{ getAllEmailAnalytics: EmailAnalyticsRow[] }>(
    GET_EMAIL_TRACKING_STATS,
    {
      skip: !trackingEnabled,
      fetchPolicy: 'cache-and-network',
      pollInterval: 60_000,
    },
  );

  const analytics = data?.getAllEmailAnalytics ?? [];

  const stats = useMemo(() => {
    if (emailId) {
      const row = analytics.find((r) => r.emailId === emailId);
      if (!row) return null;
      return {
        totalEmails: 1,
        totalOpens: row.openCount,
        totalClicks: row.clickCount,
        openRate: row.openCount > 0 ? 100 : 0,
        clickRate: row.openCount > 0 ? Math.round((row.clickCount / row.openCount) * 100) : 0,
        lastUpdatedAt: row.lastUpdatedAt,
        topEmail: row,
      };
    }

    if (!analytics.length) return null;

    const totalEmails = analytics.length;
    const totalOpens = analytics.reduce((s, r) => s + r.openCount, 0);
    const totalClicks = analytics.reduce((s, r) => s + r.clickCount, 0);
    const emailsWithOpens = analytics.filter((r) => r.openCount > 0).length;
    const openRate = Math.round((emailsWithOpens / totalEmails) * 100);
    const emailsWithClicks = analytics.filter((r) => r.clickCount > 0).length;
    const clickRate = Math.round((emailsWithClicks / totalEmails) * 100);
    const latest = analytics.slice().sort(
      (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime(),
    )[0];
    const topEmail = analytics.slice().sort((a, b) => b.openCount - a.openCount)[0];

    return {
      totalEmails,
      totalOpens,
      totalClicks,
      openRate,
      clickRate,
      lastUpdatedAt: latest?.lastUpdatedAt,
      topEmail,
    };
  }, [analytics, emailId]);

  if (!trackingEnabled) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-2 p-6 text-center', className)}>
        <BarChart2 className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Email tracking is disabled</p>
        <p className="text-xs text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_ENABLE_EMAIL_TRACKING=true</code> to enable.
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className={cn('space-y-3 p-4', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-2 p-6 text-center', className)}>
        <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">No tracking data yet</p>
        <p className="text-xs text-muted-foreground">
          Tracking data appears after recipients open or click links in your sent emails.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex flex-col gap-3 p-4', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {emailId ? 'Email Tracking' : 'Tracking Overview'}
            </h3>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="rounded-md p-1 text-muted-foreground/60 hover:text-muted-foreground" aria-label="Tracking info">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-xs">
              Open and click rates are tracked using invisible pixels and link redirects in sent emails.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Eye}
            label={emailId ? 'Opens' : 'Open Rate'}
            value={emailId ? stats.totalOpens : `${stats.openRate}%`}
            sub={emailId ? undefined : `${stats.totalOpens} total opens`}
            accent="blue"
          />
          <StatCard
            icon={MousePointerClick}
            label={emailId ? 'Clicks' : 'Click Rate'}
            value={emailId ? stats.totalClicks : `${stats.clickRate}%`}
            sub={emailId ? undefined : `${stats.totalClicks} total clicks`}
            accent="emerald"
          />
        </div>

        {!emailId && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={BarChart2}
              label="Tracked Emails"
              value={stats.totalEmails}
              accent="purple"
            />
            <StatCard
              icon={TrendingUp}
              label="CTR"
              value={stats.openRate > 0 ? `${Math.round((stats.clickRate / stats.openRate) * 100)}%` : '—'}
              sub="Clicks per open"
              accent="amber"
            />
          </div>
        )}

        {/* Open rate bar */}
        <div className="rounded-xl border border-border/50 bg-card/60 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{emailId ? 'Engagement' : 'Open rate'}</span>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px]"
              style={{
                backgroundColor: stats.openRate >= 40 ? '#10b98120' : stats.openRate >= 20 ? '#f59e0b20' : '#ef444420',
                color: stats.openRate >= 40 ? '#10b981' : stats.openRate >= 20 ? '#f59e0b' : '#ef4444',
                borderColor: stats.openRate >= 40 ? '#10b98140' : stats.openRate >= 20 ? '#f59e0b40' : '#ef444440',
              }}
            >
              {stats.openRate >= 40 ? 'Good' : stats.openRate >= 20 ? 'Average' : 'Low'}
            </Badge>
          </div>
          <Progress
            value={stats.openRate}
            className="h-2"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Industry average open rate: ~21%
          </p>
        </div>

        {/* Last activity */}
        {stats.lastUpdatedAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last activity{' '}
            {formatDistanceToNow(new Date(stats.lastUpdatedAt), { addSuffix: true })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
