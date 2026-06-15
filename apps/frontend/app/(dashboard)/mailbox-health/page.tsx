'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/primitives/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  GET_MY_MAILBOX_SYNC_RUN_STATS,
  GET_MY_MAILBOX_SYNC_RUN_SERIES,
  GET_MY_MAILBOX_SYNC_INCIDENT_STATS,
  GET_MY_MAILBOX_SYNC_INCIDENT_ALERTS,
  GET_MY_MAILBOX_SYNC_INCIDENT_ALERT_DELIVERY_STATS,
  GET_MY_MAILBOX_SYNC_DATA_EXPORT,
  GET_MY_MAILBOX_SYNC_INCIDENT_DATA_EXPORT,
  GET_MY_MAILBOX_INBOUND_DATA_EXPORT,
  RUN_MY_MAILBOX_SYNC_INCIDENT_ALERT_CHECK,
  SYNC_MY_MAILBOX_PULL,
  PURGE_MY_MAILBOX_SYNC_RUN_RETENTION_DATA,
} from '@/lib/apollo/queries/mailbox-health';
import {
  GET_MY_MAILBOX_INBOUND_EVENT_SERIES,
  GET_MY_MAILBOX_INBOUND_EVENT_STATS,
} from '@/lib/apollo/queries/mailbox-observability';
import { useDataExport } from '@/lib/hooks/useDataExport';
import { cn } from '@/lib/tokens/cn';

const TIME_WINDOWS = [
  { value: '24', label: 'Last 24 hours' },
  { value: '48', label: 'Last 48 hours' },
  { value: '168', label: 'Last 7 days' },
];

type SyncIncidentAlert = {
  notificationId: string;
  workspaceId?: string | null;
  status: string;
  title: string;
  message: string;
  incidentRatePercent: number;
  incidentRuns: number;
  totalRuns: number;
  createdAt: string;
};

function StatCard({
  title,
  value,
  sub,
  loading,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  sub?: string;
  loading: boolean;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-20" />
          ) : (
            <p className={cn('mt-1 text-3xl font-bold', color)}>{value}</p>
          )}
          {sub && !loading && (
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

export default function MailboxHealthPage() {
  const { toast } = useToast();
  const [windowHours, setWindowHours] = useState(24);
  const [showAlertCheckDialog, setShowAlertCheckDialog] = useState(false);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [purgeRetentionDays, setPurgeRetentionDays] = useState(30);

  // Stat queries
  const { data: syncRunStats, loading: syncRunStatsLoading } = useQuery(
    GET_MY_MAILBOX_SYNC_RUN_STATS,
    { variables: { windowHours }, pollInterval: 60_000 },
  );
  const { data: incidentStats, loading: incidentStatsLoading } = useQuery(
    GET_MY_MAILBOX_SYNC_INCIDENT_STATS,
    { variables: { windowHours }, pollInterval: 60_000 },
  );
  const { data: alertDeliveryStats, loading: alertDeliveryStatsLoading } = useQuery(
    GET_MY_MAILBOX_SYNC_INCIDENT_ALERT_DELIVERY_STATS,
    { variables: { windowHours }, pollInterval: 60_000 },
  );
  const { data: inboundEventStats, loading: inboundEventStatsLoading } = useQuery(
    GET_MY_MAILBOX_INBOUND_EVENT_STATS,
    { variables: { windowHours }, pollInterval: 60_000 },
  );

  // Series for charts
  const { data: syncRunSeries } = useQuery(GET_MY_MAILBOX_SYNC_RUN_SERIES, {
    variables: { windowHours, bucketMinutes: windowHours <= 24 ? 60 : 360 },
    pollInterval: 60_000,
  });
  const { data: inboundEventSeries } = useQuery(GET_MY_MAILBOX_INBOUND_EVENT_SERIES, {
    variables: { windowHours, bucketMinutes: windowHours <= 24 ? 60 : 360 },
    pollInterval: 60_000,
  });

  // Alerts table
  const { data: alertsData, loading: alertsLoading } = useQuery(
    GET_MY_MAILBOX_SYNC_INCIDENT_ALERTS,
    { variables: { windowHours, limit: 20 }, pollInterval: 60_000 },
  );

  // Mutations
  const [runAlertCheck, { loading: runningAlertCheck }] = useMutation(
    RUN_MY_MAILBOX_SYNC_INCIDENT_ALERT_CHECK,
    {
      onCompleted: (data) => {
        const result = data.runMyMailboxSyncIncidentAlertCheck;
        toast({
          title: 'Alert check completed',
          description: `Status: ${result.status} — ${result.shouldAlert ? 'Alert triggered' : 'No alert triggered'}`,
        });
        setShowAlertCheckDialog(false);
      },
      onError: (err) => {
        toast({ title: 'Alert check failed', description: err.message, variant: 'destructive' });
      },
    },
  );

  const [syncMailbox, { loading: syncingMailbox }] = useMutation(SYNC_MY_MAILBOX_PULL, {
    onCompleted: (data) => {
      const result = data.syncMyMailboxPull;
      toast({
        title: 'Sync completed',
        description: `Polled ${result.polledMailboxes} mailbox(es), fetched ${result.fetchedMessages} messages`,
      });
    },
    onError: (err) => {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    },
  });

  const [purgeRetention, { loading: purgingRetention }] = useMutation(
    PURGE_MY_MAILBOX_SYNC_RUN_RETENTION_DATA,
    {
      onCompleted: (data) => {
        const result = data.purgeMyMailboxSyncRunRetentionData;
        toast({
          title: 'Purge completed',
          description: `Deleted ${result.deletedRuns} sync run records older than ${result.retentionDays} days`,
        });
        setShowPurgeDialog(false);
      },
      onError: (err) => {
        toast({ title: 'Purge failed', description: err.message, variant: 'destructive' });
      },
    },
  );

  // Export hooks
  const { runExport: exportSyncData, loading: exportingSyncData } = useDataExport(
    GET_MY_MAILBOX_SYNC_DATA_EXPORT,
    `mailbox-sync-data-${Date.now()}.json`,
    { windowHours },
  );
  const { runExport: exportIncidentData, loading: exportingIncidentData } = useDataExport(
    GET_MY_MAILBOX_SYNC_INCIDENT_DATA_EXPORT,
    `mailbox-incidents-${Date.now()}.json`,
    { windowHours },
  );
  const { runExport: exportInboundData, loading: exportingInboundData } = useDataExport(
    GET_MY_MAILBOX_INBOUND_DATA_EXPORT,
    `mailbox-inbound-${Date.now()}.json`,
    { windowHours },
  );

  const stats = syncRunStats?.myMailboxSyncRunStats;
  const incidents = incidentStats?.myMailboxSyncIncidentStats;
  const delivery = alertDeliveryStats?.myMailboxSyncIncidentAlertDeliveryStats;
  const inboundStats = inboundEventStats?.myMailboxInboundEventStats;

  const successRate =
    stats && stats.totalRuns > 0
      ? Math.round((stats.successRuns / stats.totalRuns) * 100)
      : 0;

  const alertDeliveryRate =
    delivery && delivery.totalCount > 0
      ? Math.round(((delivery.totalCount - (delivery.warningCount + delivery.criticalCount)) / delivery.totalCount) * 100)
      : 100;

  const syncChartData = (syncRunSeries?.myMailboxSyncRunSeries ?? []).map(
    (p: { bucketStart: string; successRuns: number; failedRuns: number; partialRuns: number }) => ({
      time: format(parseISO(p.bucketStart), 'HH:mm'),
      success: p.successRuns,
      failed: p.failedRuns,
      partial: p.partialRuns,
    }),
  );

  const inboundChartData = (inboundEventSeries?.myMailboxInboundEventSeries ?? []).map(
    (p: { bucketStart: string; acceptedCount: number; rejectedCount: number; deduplicatedCount: number }) => ({
      time: format(parseISO(p.bucketStart), 'HH:mm'),
      accepted: p.acceptedCount,
      rejected: p.rejectedCount,
      deduplicated: p.deduplicatedCount,
    }),
  );

  const alerts: SyncIncidentAlert[] = alertsData?.myMailboxSyncIncidentAlerts ?? [];

  return (
    <DashboardPageShell
      title="Mailbox Health"
      description="Sync status, incident trends, and alert delivery observability"
      actions={
        <div className="flex items-center gap-2">
          <Select
            value={String(windowHours)}
            onValueChange={(v) => setWindowHours(Number(v))}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Sync Runs"
            value={stats?.totalRuns ?? 0}
            sub={`Avg ${Math.round(stats?.avgDurationMs ?? 0)}ms per run`}
            loading={syncRunStatsLoading}
            icon={RefreshCw}
          />
          <StatCard
            title="Success Rate"
            value={`${successRate}%`}
            sub={`${stats?.successRuns ?? 0} success / ${stats?.failedRuns ?? 0} failed`}
            loading={syncRunStatsLoading}
            icon={CheckCircle}
            color={successRate >= 90 ? 'text-emerald-600' : successRate >= 70 ? 'text-amber-600' : 'text-red-600'}
          />
          <StatCard
            title="Sync Incidents"
            value={incidents?.incidentRuns ?? 0}
            sub={`${(incidents?.incidentRatePercent ?? 0).toFixed(1)}% incident rate`}
            loading={incidentStatsLoading}
            icon={AlertTriangle}
            color={(incidents?.incidentRuns ?? 0) > 0 ? 'text-amber-600' : 'text-foreground'}
          />
          <StatCard
            title="Inbound Accepted"
            value={inboundStats?.[0]?.acceptedCount ?? 0}
            sub={`${(inboundStats?.[0]?.successRatePercent ?? 0).toFixed(1)}% SLA success rate`}
            loading={inboundEventStatsLoading}
            icon={Activity}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium">Sync Run Health</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportSyncData()}
                disabled={exportingSyncData}
              >
                <Download className="mr-1 h-3 w-3" />
                Export
              </Button>
            </div>
            <div className="pt-2">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={syncChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="success" stackId="1" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.2)" name="Success" />
                  <Area type="monotone" dataKey="partial" stackId="1" stroke="hsl(38 92% 50%)" fill="hsl(38 92% 50% / 0.2)" name="Partial" />
                  <Area type="monotone" dataKey="failed" stackId="1" stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60% / 0.2)" name="Failed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium">Inbound Events</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportInboundData()}
                disabled={exportingInboundData}
              >
                <Download className="mr-1 h-3 w-3" />
                Export
              </Button>
            </div>
            <div className="pt-2">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={inboundChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accepted" fill="hsl(142 76% 36%)" name="Accepted" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="rejected" fill="hsl(0 84% 60%)" name="Rejected" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="deduplicated" fill="hsl(262 83% 58%)" name="Deduplicated" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Incident Alerts Table */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-sm font-medium">Sync Incident Alerts</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportIncidentData()}
              disabled={exportingIncidentData}
            >
              <Download className="mr-1 h-3 w-3" />
              Export Incidents
            </Button>
          </div>
          <div className="p-0 pt-4">
            {alertsLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle className="mb-3 h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium">No incidents in this window</p>
                <p className="text-xs">All sync runs are healthy</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alert</TableHead>
                    <TableHead>Incident Rate</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Triggered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.notificationId}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{alert.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{alert.message}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'text-sm font-medium',
                          alert.incidentRatePercent > 20 ? 'text-red-600' : 'text-amber-600',
                        )}>
                          {alert.incidentRatePercent.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {alert.incidentRuns}/{alert.totalRuns}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={alert.status === 'CRITICAL' ? 'error' : 'info'}
                          label={alert.status}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(alert.createdAt), 'MMM d, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Manual Controls */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
          <h3 className="text-sm font-medium">Manual Controls</h3>
          <div className="flex flex-wrap gap-3 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAlertCheckDialog(true)}
              disabled={runningAlertCheck}
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Run Alert Check
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMailbox()}
              disabled={syncingMailbox}
            >
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', syncingMailbox && 'animate-spin')} />
              Force Sync All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPurgeDialog(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Purge Old Logs
            </Button>
          </div>
        </div>
      </div>

      {/* Alert Check Dialog */}
      <Dialog open={showAlertCheckDialog} onOpenChange={setShowAlertCheckDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Incident Alert Check</DialogTitle>
            <DialogDescription>
              Manually trigger the mailbox sync incident alert evaluation. This uses default
              thresholds configured in your alert settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlertCheckDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => runAlertCheck()}
              disabled={runningAlertCheck}
            >
              {runningAlertCheck ? 'Running…' : 'Run Check'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purge Dialog */}
      <Dialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purge Sync Run Logs</DialogTitle>
            <DialogDescription>
              Delete sync run records older than the specified number of days. This action is
              irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label htmlFor="retention-days">Retain logs for (days)</Label>
            <Input
              id="retention-days"
              type="number"
              min={1}
              max={365}
              value={purgeRetentionDays}
              onChange={(e) => setPurgeRetentionDays(Number(e.target.value))}
              className="mt-1.5 w-32"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurgeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => purgeRetention({ variables: { retentionDays: purgeRetentionDays } })}
              disabled={purgingRetention}
            >
              {purgingRetention ? 'Purging…' : `Purge logs older than ${purgeRetentionDays}d`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
}
