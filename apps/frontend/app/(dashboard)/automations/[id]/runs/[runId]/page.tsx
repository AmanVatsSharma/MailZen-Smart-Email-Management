/**
 * File:        apps/frontend/app/(dashboard)/automations/[id]/runs/[runId]/page.tsx
 * Module:      Frontend · Automations · Run Detail Page
 * Purpose:     Audit timeline for a single AutomationRun — shows each AutomationStepRun
 *              with status, attempt count, start/finish times, and expandable input/output JSON.
 *              Provides retry and cancel buttons for non-terminal runs.
 *
 * Exports:
 *   - AutomationRunDetailPage  — default export, Next.js App Router page component
 *
 * Depends on:
 *   - GET_AUTOMATION_RUN, RETRY_AUTOMATION_RUN, CANCEL_AUTOMATION_RUN
 *     — from @/lib/apollo/queries/automations
 *   - DashboardPageShell — shared page wrapper
 *
 * Side-effects:
 *   - Apollo mutations for retry/cancel
 *   - Auto-refetch every 5s when run is in non-terminal state (QUEUED or RUNNING)
 *
 * Key invariants:
 *   - stepIndex is 0-based; displayed as 1-based in UI
 *   - Multiple attempt rows can exist per (runId, stepIndex) — sorted by attempt ASC
 *   - correlationId should be copied for log grep
 *
 * Read order:
 *   1. Types
 *   2. STATUS constants
 *   3. StepRunRow sub-component
 *   4. AutomationRunDetailPage main component
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  SkipForward,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_AUTOMATION_RUN,
  RETRY_AUTOMATION_RUN,
  CANCEL_AUTOMATION_RUN,
} from '@/lib/apollo/queries/automations';

// ─── Types ─────────────────────────────────────────────────────────────────────

type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'SKIPPED_CONDITIONS';
type StepStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'RETRYING';

type StepRun = {
  id: string;
  stepIndex: number;
  stepType: string;
  status: StepStatus;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  attempt: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

type AutomationRun = {
  id: string;
  automationId: string;
  status: RunStatus;
  correlationId: string;
  triggerEvent?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  steps: StepRun[];
};

// ─── Status display ────────────────────────────────────────────────────────────

const RUN_STEP_STATUS_ICON: Record<StepStatus, React.ReactNode> = {
  SUCCEEDED: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />,
  FAILED:    <XCircle className="h-4 w-4 text-destructive shrink-0" />,
  RUNNING:   <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />,
  RETRYING:  <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin shrink-0" />,
  PENDING:   <Clock className="h-4 w-4 text-muted-foreground shrink-0" />,
  SKIPPED:   <SkipForward className="h-4 w-4 text-muted-foreground shrink-0" />,
};

const RUN_STATUS_BADGE_CLASS: Record<RunStatus, string> = {
  SUCCEEDED:           'bg-green-500/15 text-green-700 border-green-200 dark:text-green-400',
  FAILED:              'bg-destructive/15 text-destructive border-destructive/20',
  RUNNING:             'bg-blue-500/15 text-blue-700 border-blue-200 dark:text-blue-400',
  QUEUED:              'text-muted-foreground',
  CANCELED:            'text-muted-foreground',
  SKIPPED_CONDITIONS:  'bg-yellow-500/15 text-yellow-700 border-yellow-200 dark:text-yellow-400',
};

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  SUCCEEDED: 'Succeeded', FAILED: 'Failed', RUNNING: 'Running',
  QUEUED: 'Queued', CANCELED: 'Canceled', SKIPPED_CONDITIONS: 'Skipped (conditions)',
};

const TERMINAL_STATUSES: RunStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELED', 'SKIPPED_CONDITIONS'];

// ─── StepRunRow ────────────────────────────────────────────────────────────────

function JsonExpandable({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        {label}
      </button>
      {open && (
        <pre className="text-xs bg-muted rounded-md p-2.5 mt-1.5 overflow-auto max-h-40 whitespace-pre-wrap break-all leading-relaxed">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

function StepRunRow({ step }: { step: StepRun }) {
  const duration =
    step.startedAt && step.finishedAt
      ? Math.round((new Date(step.finishedAt).getTime() - new Date(step.startedAt).getTime()) / 1000)
      : null;

  return (
    <div className="flex gap-3 py-3 px-3 border-b last:border-0">
      <div className="flex flex-col items-center gap-1 pt-0.5">
        {RUN_STEP_STATUS_ICON[step.status]}
        {/* timeline connector */}
        <div className="w-px flex-1 bg-border min-h-[8px]" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-muted-foreground shrink-0">#{step.stepIndex + 1}</span>
            <span className="text-sm font-medium truncate">{step.stepType}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
            {step.attempt > 1 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">attempt {step.attempt}</Badge>
            )}
            {duration !== null && <span>{duration}s</span>}
            {step.startedAt && (
              <span title={format(parseISO(step.startedAt), 'PPpp')}>
                {format(parseISO(step.startedAt), 'HH:mm:ss')}
              </span>
            )}
          </div>
        </div>
        {(step.errorCode || step.errorMessage) && (
          <p className="text-xs text-destructive mt-1">
            {step.errorCode && <span className="font-mono mr-1">{step.errorCode}:</span>}
            {step.errorMessage}
          </p>
        )}
        <JsonExpandable label="Input" value={step.input} />
        <JsonExpandable label="Output" value={step.output} />
      </div>
    </div>
  );
}

// ─── AutomationRunDetailPage ───────────────────────────────────────────────────

export default function AutomationRunDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const automationId = params.id as string;
  const runId = params.runId as string;

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery<{
    automationRun: AutomationRun | null;
  }>(GET_AUTOMATION_RUN, {
    variables: { id: runId },
    fetchPolicy: 'cache-and-network',
  });

  const run = data?.automationRun;

  // Poll while run is in non-terminal state
  useEffect(() => {
    if (run && !TERMINAL_STATUSES.includes(run.status)) {
      startPolling(5000);
    } else {
      stopPolling();
    }
  }, [run?.status, startPolling, stopPolling]);

  const [retryRun, { loading: retrying }] = useMutation(RETRY_AUTOMATION_RUN, {
    onCompleted: async () => { await refetch(); toast({ title: 'Run retried', description: 'A new run has been queued.' }); },
    onError: (err) => toast({ title: 'Failed to retry', description: err.message, variant: 'destructive' }),
  });

  const [cancelRun, { loading: canceling }] = useMutation(CANCEL_AUTOMATION_RUN, {
    onCompleted: async () => { await refetch(); toast({ title: 'Run canceled' }); },
    onError: (err) => toast({ title: 'Failed to cancel', description: err.message, variant: 'destructive' }),
  });

  const copyCorrelationId = () => {
    if (!run) return;
    void navigator.clipboard.writeText(run.correlationId);
    toast({ title: 'Copied correlation ID' });
  };

  if (loading && !data) {
    return (
      <DashboardPageShell title="Run details">
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </DashboardPageShell>
    );
  }

  if (error || !run) {
    return (
      <DashboardPageShell title="Run not found">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error?.message ?? 'Run not found'}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/automations/${automationId}`}>Back to automation</Link>
          </Button>
        </div>
      </DashboardPageShell>
    );
  }

  const isTerminal = TERMINAL_STATUSES.includes(run.status);

  return (
    <DashboardPageShell
      title="Run details"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/automations/${automationId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          {run.status === 'FAILED' && (
            <Button
              variant="outline"
              size="sm"
              disabled={retrying}
              onClick={() => void retryRun({ variables: { runId } })}
            >
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Retry</span>
            </Button>
          )}
          {!isTerminal && (
            <Button
              variant="outline"
              size="sm"
              disabled={canceling}
              onClick={() => void cancelRun({ variables: { runId } })}
            >
              {canceling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Cancel</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5 max-w-2xl">
        {/* Run summary */}
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${RUN_STATUS_BADGE_CLASS[run.status]}`}
                >
                  {RUN_STATUS_LABEL[run.status]}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(parseISO(run.createdAt), { addSuffix: true })}
              </span>
            </div>
            {(run.errorCode || run.errorMessage) && (
              <p className="text-sm text-destructive">
                {run.errorCode && <span className="font-mono mr-1">{run.errorCode}:</span>}
                {run.errorMessage}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono truncate">{run.correlationId}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={copyCorrelationId}
                title="Copy correlation ID for log search"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            {run.startedAt && (
              <p className="text-xs text-muted-foreground">
                Started {format(parseISO(run.startedAt), 'PPp')}
                {run.finishedAt && ` · finished ${format(parseISO(run.finishedAt), 'HH:mm:ss')}`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Step audit timeline */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Step audit trail</h2>
          {run.steps.length === 0 ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Circle className="h-5 w-5" />
              <span className="text-sm">No steps recorded yet.</span>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {run.steps
                  .slice()
                  .sort((a, b) => a.stepIndex - b.stepIndex || a.attempt - b.attempt)
                  .map((step) => (
                    <StepRunRow key={step.id} step={step} />
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardPageShell>
  );
}
