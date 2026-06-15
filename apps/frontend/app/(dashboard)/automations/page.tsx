/**
 * File:        apps/frontend/app/(dashboard)/automations/page.tsx
 * Module:      Frontend · Automations · List Page
 * Purpose:     Workspace automation list — shows all automations with status pill,
 *              last-run info, enable/disable toggle, and a "New Automation" CTA.
 *
 * Exports:
 *   - AutomationsPage  — default export, Next.js App Router page component
 *
 * Depends on:
 *   - GET_AUTOMATIONS, ENABLE_AUTOMATION, DISABLE_AUTOMATION, ARCHIVE_AUTOMATION
 *     — from @/lib/apollo/queries/automations
 *   - DashboardPageShell — shared page wrapper with title + actions slot
 *
 * Side-effects:
 *   - Apollo cache writes on enable/disable/archive mutations
 *
 * Key invariants:
 *   - workspaceId read from localStorage('mailzen.selectedWorkspaceId')
 *   - Query skipped when workspaceId is not yet known
 *   - Status transitions: DRAFT/DISABLED → enable → ENABLED; ENABLED → disable → DISABLED
 *
 * Read order:
 *   1. Types (Automation, AutomationRun)
 *   2. AutomationStatusPill
 *   3. AutomationCard
 *   4. AutomationsPage (main component)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-07
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@apollo/client';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Lock,
  Loader2,
  Plus,
  Search,
  XCircle,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/primitives/status-badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_AUTOMATIONS,
  ENABLE_AUTOMATION,
  DISABLE_AUTOMATION,
  ARCHIVE_AUTOMATION,
} from '@/lib/apollo/queries/automations';
import { GET_ENTITLEMENT_USAGE } from '@/lib/apollo/queries/billing';
import { UpgradePlanModal } from '@/components/billing/UpgradePlanModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type AutomationStatus = 'DRAFT' | 'ENABLED' | 'DISABLED' | 'ARCHIVED';
type AutomationRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'SKIPPED_CONDITIONS';

type AutomationRun = {
  id: string;
  status: AutomationRunStatus;
  createdAt: string;
};

type Automation = {
  id: string;
  name: string;
  description?: string | null;
  status: AutomationStatus;
  createdAt: string;
  updatedAt: string;
  recentRuns?: AutomationRun[];
};

// ─── StatusPill ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AutomationStatus, { label: string; status: 'success' | 'info' | 'warning' | 'error' | 'pending' | 'online' | 'offline' | 'syncing' }> = {
  ENABLED:  { label: 'Enabled',  status: 'success' },
  DISABLED: { label: 'Disabled', status: 'offline' },
  DRAFT:    { label: 'Draft',    status: 'warning' },
  ARCHIVED: { label: 'Archived', status: 'error' },
};

function AutomationStatusPill({ status }: { status: AutomationStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DISABLED;
  return (
    <StatusBadge status={cfg.status} label={cfg.label} className="text-xs font-medium" />
  );
}

// ─── RunStatusIcon ─────────────────────────────────────────────────────────────

function RunStatusIcon({ status }: { status: AutomationRunStatus }) {
  switch (status) {
    case 'SUCCEEDED':  return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'FAILED':     return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'RUNNING':    return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case 'CANCELED':   return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
    default:           return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// ─── AutomationCard ────────────────────────────────────────────────────────────

function AutomationCardSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
      <div className="flex flex-col gap-1.5 p-6 pb-3 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <div className="p-6 pt-0 pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

interface AutomationCardProps {
  automation: Automation;
  workspaceId: string;
  onToggle: (id: string, currentStatus: AutomationStatus) => void;
  onArchive: (id: string) => void;
  toggling: boolean;
}

function AutomationCard({ automation, workspaceId, onToggle, onArchive, toggling }: AutomationCardProps) {
  const lastRun = automation.recentRuns?.[0];
  const isEnabled = automation.status === 'ENABLED';
  const canToggle = automation.status === 'ENABLED' || automation.status === 'DISABLED' || automation.status === 'DRAFT';

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden transition-shadow hover:shadow-md group">
      <div className="flex flex-col gap-1.5 p-6 pb-2 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="h-4 w-4 text-purple-500 shrink-0" />
            <Link
              href={`/automations/${automation.id}`}
              className="font-medium text-sm truncate hover:underline underline-offset-2"
            >
              {automation.name}
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AutomationStatusPill status={automation.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/automations/${automation.id}`}>View details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/automations/${automation.id}?edit=1`}>Edit</Link>
                </DropdownMenuItem>
                {automation.status !== 'ARCHIVED' && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onArchive(automation.id)}
                  >
                    Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {automation.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5 pl-6">
            {automation.description}
          </p>
        )}
      </div>
      <div className="p-6 pt-0 pb-3">
        <div className="flex items-center justify-between pl-6">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {lastRun ? (
              <>
                <RunStatusIcon status={lastRun.status} />
                <span>
                  Last run {formatDistanceToNow(parseISO(lastRun.createdAt), { addSuffix: true })}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Never run</span>
              </>
            )}
          </div>
          {canToggle && (
            <Switch
              checked={isEnabled}
              disabled={toggling || automation.status === 'ARCHIVED'}
              onCheckedChange={() => onToggle(automation.id, automation.status)}
              aria-label={isEnabled ? 'Disable automation' : 'Enable automation'}
              className="data-[state=checked]:bg-purple-600"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AutomationsPage ──────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { toast } = useToast();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('mailzen.selectedWorkspaceId') : null;
    setWorkspaceId(id);
  }, []);

  const { data: entitlementData } = useQuery<{
    myEntitlementUsage: { automationsEnabled: boolean };
  }>(GET_ENTITLEMENT_USAGE);

  const automationsEnabled = entitlementData?.myEntitlementUsage?.automationsEnabled ?? true;

  const { data, loading, error, refetch } = useQuery<{
    automations: { nodes: Automation[]; nextCursor?: string | null };
  }>(GET_AUTOMATIONS, {
    variables: { workspaceId: workspaceId ?? '', limit: 50 },
    skip: !workspaceId,
    fetchPolicy: 'cache-and-network',
  });

  const [enableAutomation] = useMutation(ENABLE_AUTOMATION, {
    onCompleted: async () => { await refetch(); },
    onError: (err) => toast({ title: 'Failed to enable', description: err.message, variant: 'destructive' }),
  });

  const [disableAutomation] = useMutation(DISABLE_AUTOMATION, {
    onCompleted: async () => { await refetch(); },
    onError: (err) => toast({ title: 'Failed to disable', description: err.message, variant: 'destructive' }),
  });

  const [archiveAutomation] = useMutation(ARCHIVE_AUTOMATION, {
    onCompleted: async () => {
      await refetch();
      toast({ title: 'Automation archived', description: 'The automation has been archived.' });
    },
    onError: (err) => toast({ title: 'Failed to archive', description: err.message, variant: 'destructive' }),
  });

  const handleToggle = async (id: string, currentStatus: AutomationStatus) => {
    if (!workspaceId) return;
    setTogglingId(id);
    try {
      if (currentStatus === 'ENABLED') {
        await disableAutomation({ variables: { id, workspaceId } });
        toast({ title: 'Automation disabled' });
      } else {
        await enableAutomation({ variables: { id, workspaceId } });
        toast({ title: 'Automation enabled' });
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleArchive = async (id: string) => {
    if (!workspaceId) return;
    await archiveAutomation({ variables: { id, workspaceId } });
  };

  const automations = data?.automations.nodes ?? [];
  const filtered = search
    ? automations.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : automations;

  return (
    <DashboardPageShell
      title="Automations"
      description="Workspace workflow automations — trigger actions when emails arrive, are assigned, or labelled."
      actions={
        automationsEnabled ? (
          <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
            <Link href="/automations/new">
              <Plus className="h-4 w-4 mr-1.5" />
              New Automation
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="opacity-60 cursor-not-allowed"
            title="Upgrade to Pro to create automations"
            onClick={() => setUpgradeModalOpen(true)}
          >
            <Lock className="h-4 w-4 mr-1.5" />
            New Automation
          </Button>
        )
      }
    >
      <UpgradePlanModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search automations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <AutomationCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10">
            <Zap className="h-7 w-7 text-purple-500" />
          </div>
          <div>
            <p className="font-medium">
              {search ? 'No automations match your search' : 'No automations yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? 'Try a different keyword.'
                : 'Create your first automation to start automating email workflows.'}
            </p>
          </div>
          {!search && (
            automationsEnabled ? (
              <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700 text-white mt-2">
                <Link href="/automations/new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Automation
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="opacity-60 mt-2"
                onClick={() => setUpgradeModalOpen(true)}
              >
                <Lock className="h-4 w-4 mr-1.5" />
                Upgrade to create automations
              </Button>
            )
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              workspaceId={workspaceId!}
              onToggle={(id, status) => void handleToggle(id, status)}
              onArchive={(id) => void handleArchive(id)}
              toggling={togglingId === automation.id}
            />
          ))}
        </div>
      )}
    </DashboardPageShell>
  );
}
