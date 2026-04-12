'use client';

import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Bot, Download, ShieldCheck } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  GET_MY_AGENT_ACTION_AUDITS,
  GET_MY_AGENT_ACTION_DATA_EXPORT,
} from '@/lib/apollo/queries/agent-audit';
import { useDataExport } from '@/lib/hooks/useDataExport';
import { format, parseISO, subHours } from 'date-fns';
import { cn } from '@/lib/utils';

const SKILL_OPTIONS = [
  { value: 'ALL', label: 'All skills' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'triage', label: 'Triage' },
  { value: 'summarize', label: 'Summarize' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'unsubscribe', label: 'Unsubscribe' },
  { value: 'coordinator', label: 'Coordinator' },
];

const DATE_WINDOWS = [
  { value: '24', label: 'Last 24 hours' },
  { value: '168', label: 'Last 7 days' },
  { value: '720', label: 'Last 30 days' },
];

type AgentAudit = {
  id: string;
  requestId: string;
  skill: string;
  action: string;
  executed: boolean;
  approvalRequired: boolean;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export default function AiAuditPage() {
  const [limit, setLimit] = useState(25);
  const [filterSkill, setFilterSkill] = useState('ALL');
  const [filterWindow, setFilterWindow] = useState('168');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const { data, loading } = useQuery(GET_MY_AGENT_ACTION_AUDITS, {
    variables: { limit },
    pollInterval: 120_000,
    fetchPolicy: 'cache-and-network',
  });

  const { runExport, loading: exporting } = useDataExport(
    GET_MY_AGENT_ACTION_DATA_EXPORT,
    `ai-audit-log-${Date.now()}.json`,
    { limit },
  );

  const audits: AgentAudit[] = data?.myAgentActionAudits ?? [];

  const windowCutoff = subHours(new Date(), Number(filterWindow));

  const filtered = audits.filter((a) => {
    if (filterSkill !== 'ALL' && a.skill !== filterSkill) return false;
    if (filterStatus === 'EXECUTED' && !a.executed) return false;
    if (filterStatus === 'PENDING' && (a.executed || !a.approvalRequired)) return false;
    if (parseISO(a.createdAt) < windowCutoff) return false;
    return true;
  });

  return (
    <DashboardPageShell
      title="AI Action Audit Log"
      description="Complete history of all AI agent actions taken on your behalf"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => runExport()}
          disabled={exporting}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export Log
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterSkill} onValueChange={setFilterSkill}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All skills" />
            </SelectTrigger>
            <SelectContent>
              {SKILL_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterWindow} onValueChange={setFilterWindow}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="EXECUTED">Executed</SelectItem>
              <SelectItem value="PENDING">Pending approval</SelectItem>
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading && audits.length === 0 ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShieldCheck className="mb-3 h-10 w-10 opacity-40" />
                <p className="text-sm font-medium">No audit records found</p>
                <p className="text-xs">AI actions will appear here as the platform operates</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Skill</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(audit.createdAt), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {audit.skill}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{audit.action}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate text-xs text-muted-foreground">{audit.message}</p>
                      </TableCell>
                      <TableCell>
                        {audit.executed ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs border-0">
                            Executed
                          </Badge>
                        ) : audit.approvalRequired ? (
                          <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 text-xs border-0">
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Skipped
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Load more */}
        {audits.length >= limit && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 25)}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </DashboardPageShell>
  );
}
