/**
 * File:        apps/frontend/app/(dashboard)/automations/[id]/page.tsx
 * Module:      Frontend · Automations · Detail Page
 * Purpose:     Shows a single automation: current status, version history
 *              (trigger/conditions/steps JSON), recent runs with status + timestamp,
 *              enable/disable/archive actions, and a link to run detail pages.
 *
 * Exports:
 *   - AutomationDetailPage  — default export, Next.js App Router page component
 *
 * Depends on:
 *   - GET_AUTOMATION, ENABLE_AUTOMATION, DISABLE_AUTOMATION, ARCHIVE_AUTOMATION,
 *     RUN_AUTOMATION_MANUALLY — from @/lib/apollo/queries/automations
 *   - DashboardPageShell — shared page wrapper
 *
 * Side-effects:
 *   - Apollo mutations on enable/disable/archive/manual-run
 *
 * Key invariants:
 *   - workspaceId read from localStorage('mailzen.selectedWorkspaceId')
 *   - AutomationVersion is immutable — versions list shows history, never editable
 *   - Manual run creates a new AutomationRun; runs list refreshes after completion
 *
 * Read order:
 *   1. Types
 *   2. StatusPill, RunStatusBadge helpers
 *   3. VersionCard, RunRow sub-components
 *   4. AutomationDetailPage main component
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import {
  AlertCircle,
  Archive,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  Loader2,
  Play,
  XCircle,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_AUTOMATION,
  ENABLE_AUTOMATION,
  DISABLE_AUTOMATION,
  ARCHIVE_AUTOMATION,
  RUN_AUTOMATION_MANUALLY,
} from '@/lib/apollo/queries/automations';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AutomationStatus = 'DRAFT' | 'ENABLED' | 'DISABLED' | 'ARCHIVED';
type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'SKIPPED_CONDITIONS';

type AutomationVersion = {
  id: string;
  version: number;
  trigger: Record<string, unknown>;
  conditions?: Record<string, unknown> | null;
  steps: Record<string, unknown>[];
  publishedAt: string;
  publishedByUserId: string;
};

type AutomationRun = {
  id: string;
  status: RunStatus;
  correlationId: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

type AutomationDetail = {
  id: string;
  name: string;
  description?: string | null;
  status: AutomationStatus;
  currentVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
  versions: AutomationVersion[];
  recentRuns: AutomationRun[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<AutomationStatus, { label: string; className: string }> = {
  ENABLED:  { label: 'Enabled',  className: 'bg-green-500/15 text-green-700 border-green-200 dark:text-green-400' },
  DISABLED: { label: 'Disabled', className: 'text-muted-foreground' },
  DRAFT:    { label: 'Draft',    className: 'bg-yellow-500/15 text-yellow-700 border-yellow-200 dark:text-yellow-400' },
  ARCHIVED: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
};

function StatusBadge({ status }: { status: AutomationStatus }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.DISABLED;
  return <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>;
}

const RUN_STATUS_ICON: Record<RunStatus, React.ReactNode> = {
  SUCCEEDED:           <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED:              <XCircle className="h-4 w-4 text-destructive" />,
  RUNNING:             <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  QUEUED:              <Clock className="h-4 w-4 text-muted-foreground" />,
  CANCELED:            <Circle className="h-4 w-4 text-muted-foreground" />,
  SKIPPED_CONDITIONS:  <Circle className="h-4 w-4 text-yellow-500" />,
};

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  SUCCEEDED: 'Succeeded', FAILED: 'Failed', RUNNING: 'Running',
  QUEUED: 'Queued', CANCELED: 'Canceled', SKIPPED_CONDITIONS: 'Skipped (conditions)',
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ─── VersionCard ───────────────────────────────────────────────────────────────

function VersionCard({ version, isCurrent }: { version: AutomationVersion; isCurrent: boolean }) {
  const [open, setOpen] = useState(isCurrent);

  return (
    <Card className={isCurrent ? 'border-purple-200 dark:border-purple-800' : ''}>
      <CardHeader className="py-3 px-4">
        <button
          type="button"
          className="flex items-center justify-between w-full text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Version {version.version}</span>
            {isCurrent && (
              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400">Current</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {format(parseISO(version.publishedAt), 'MMM d, yyyy HH:mm')}
            </span>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
          </div>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 pb-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Trigger</p>
            <JsonBlock value={version.trigger} />
          </div>
          {version.conditions && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Conditions</p>
              <JsonBlock value={version.conditions} />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Steps ({version.steps.length})</p>
            <JsonBlock value={version.steps} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── RunRow ────────────────────────────────────────────────────────────────────

function RunRow({ run, automationId }: { run: AutomationRun; automationId: string }) {
  const duration =
    run.startedAt && run.finishedAt
      ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
      : null;

  return (
    <Link
      href={`/automations/${automationId}/runs/${run.id}`}
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <span className="shrink-0">{RUN_STATUS_ICON[run.status]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{RUN_STATUS_LABEL[run.status]}</span>
          {run.errorCode && (
            <span className="text-xs text-destructive font-mono">{run.errorCode}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {formatDistanceToNow(parseISO(run.createdAt), { addSuffix: true })}
          {duration !== null && ` · ${duration}s`}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}

// ─── AutomationDetailPage ──────────────────────────────────────────────────────

export default function AutomationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  useEffect(() => {
    const wsId = typeof window !== 'undefined' ? localStorage.getItem('mailzen.selectedWorkspaceId') : null;
    setWorkspaceId(wsId);
  }, []);

  const { data, loading, error, refetch } = useQuery<{ automation: AutomationDetail | null }>(
    GET_AUTOMATION,
    {
      variables: { id, workspaceId: workspaceId ?? '' },
      skip: !workspaceId,
      fetchPolicy: 'cache-and-network',
    },
  );

  const [enableAutomation] = useMutation(ENABLE_AUTOMATION, {
    onCompleted: async () => { await refetch(); toast({ title: 'Automation enabled' }); },
    onError: (err) => toast({ title: 'Failed to enable', description: err.message, variant: 'destructive' }),
  });

  const [disableAutomation] = useMutation(DISABLE_AUTOMATION, {
    onCompleted: async () => { await refetch(); toast({ title: 'Automation disabled' }); },
    onError: (err) => toast({ title: 'Failed to disable', description: err.message, variant: 'destructive' }),
  });

  const [archiveAutomation] = useMutation(ARCHIVE_AUTOMATION, {
    onCompleted: () => {
      toast({ title: 'Archived', description: 'Automation has been archived.' });
      router.push('/automations');
    },
    onError: (err) => toast({ title: 'Failed to archive', description: err.message, variant: 'destructive' }),
  });

  const [runManually, { loading: running }] = useMutation(RUN_AUTOMATION_MANUALLY, {
    onCompleted: async (d) => {
      await refetch();
      const runId = (d as { runAutomationManually: { id: string } }).runAutomationManually.id;
      toast({ title: 'Run queued', description: `Run ${runId.slice(0, 8)}… has been enqueued.` });
    },
    onError: (err) => toast({ title: 'Failed to run', description: err.message, variant: 'destructive' }),
  });

  const handleToggle = async () => {
    if (!workspaceId || !automation) return;
    setToggling(true);
    try {
      if (automation.status === 'ENABLED') {
        await disableAutomation({ variables: { id, workspaceId } });
      } else {
        await enableAutomation({ variables: { id, workspaceId } });
      }
    } finally {
      setToggling(false);
    }
  };

  const handleManualRun = async () => {
    if (!workspaceId) return;
    await runManually({ variables: { id, workspaceId } });
  };

  const automation = data?.automation;

  if (loading && !data) {
    return (
      <DashboardPageShell title="Automation" actions={<Skeleton className="h-8 w-24" />}>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardPageShell>
    );
  }

  if (error || !automation) {
    return (
      <DashboardPageShell title="Automation not found">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error?.message ?? 'Automation not found'}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/automations">Back to automations</Link>
          </Button>
        </div>
      </DashboardPageShell>
    );
  }

  const canToggle = automation.status === 'ENABLED' || automation.status === 'DISABLED' || automation.status === 'DRAFT';
  const isEnabled = automation.status === 'ENABLED';

  return (
    <DashboardPageShell
      title={automation.name}
      description={automation.description ?? undefined}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/automations">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          {canToggle && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{isEnabled ? 'Enabled' : 'Disabled'}</span>
              <Switch
                checked={isEnabled}
                disabled={toggling}
                onCheckedChange={() => void handleToggle()}
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={running || automation.status === 'ARCHIVED'}
            onClick={() => void handleManualRun()}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Run now</span>
          </Button>
          {automation.status !== 'ARCHIVED' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setArchiveDialogOpen(true)}
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
              <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Archive automation?</DialogTitle>
                    <DialogDescription>
                      This will stop the automation and move it to archived. You can view old runs but it won&apos;t fire on new events.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>Cancel</Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setArchiveDialogOpen(false);
                        void archiveAutomation({ variables: { id, workspaceId } });
                      }}
                    >
                      Archive
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6 max-w-3xl">
        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <StatusBadge status={automation.status} />
          <span>·</span>
          <span>Created {formatDistanceToNow(parseISO(automation.createdAt), { addSuffix: true })}</span>
          <span>·</span>
          <span>Updated {formatDistanceToNow(parseISO(automation.updatedAt), { addSuffix: true })}</span>
        </div>

        <Separator />

        {/* Version history */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Version history
          </h2>
          {automation.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <div className="space-y-2">
              {automation.versions.map((v) => (
                <VersionCard
                  key={v.id}
                  version={v}
                  isCurrent={v.id === automation.currentVersionId}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Recent runs */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" />
            Recent runs
          </h2>
          {automation.recentRuns.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2 text-center">
              <Circle className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No runs yet.</p>
              <p className="text-xs text-muted-foreground">Enable the automation and wait for a trigger, or click &quot;Run now&quot;.</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-2 divide-y divide-border">
                {automation.recentRuns.map((run) => (
                  <RunRow key={run.id} run={run} automationId={id} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardPageShell>
  );
}
