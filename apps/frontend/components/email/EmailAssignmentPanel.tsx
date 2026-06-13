/**
 * File:        apps/frontend/components/email/EmailAssignmentPanel.tsx
 * Module:      Email · Team Inbox · Assignment Panel
 * Purpose:     Right-side panel for assigning, transferring, or resolving email thread
 *              assignments. Shows the current assignee, a member dropdown, notes field,
 *              due date picker, and action buttons — wired to assignment mutations.
 *
 * Exports:
 *   - EmailAssignmentPanel({ threadId, workspaceId, className }) — assignment UI panel
 *   - EmailAssignmentPanelProps — prop shape
 *
 * Depends on:
 *   - @/lib/apollo/queries/emails — ASSIGN_EMAIL, TRANSFER_EMAIL, RESOLVE_EMAIL_ASSIGNMENT,
 *                                    GET_EMAIL_ASSIGNMENT
 *   - @/lib/apollo/queries/workspaces — GET_WORKSPACE_MEMBERS
 *
 * Side-effects:
 *   - Apollo mutations: assignEmail, transferEmail, resolveEmailAssignment
 *   - Apollo queries: getEmailAssignment (per-thread), workspaceMembers
 *
 * Key invariants:
 *   - workspaceId must be a non-empty string — panel renders null if absent
 *   - When an active assignment exists (status open/in_progress), UI shows Transfer+Resolve
 *   - When no assignment exists, UI shows Assign button
 *
 * Read order:
 *   1. EmailAssignmentPanelProps — component contract
 *   2. EmailAssignmentPanel      — main render + mutation wiring
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */
'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { UserCheck, UserPlus, CheckCircle, RefreshCw, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/tokens/cn';
import {
  ASSIGN_EMAIL,
  TRANSFER_EMAIL,
  RESOLVE_EMAIL_ASSIGNMENT,
  GET_EMAIL_ASSIGNMENT,
} from '@/lib/apollo/queries/emails';
import { GET_WORKSPACE_MEMBERS } from '@/lib/apollo/queries/workspaces';

export interface EmailAssignmentPanelProps {
  threadId: string;
  workspaceId: string;
  className?: string;
}

type WorkspaceMember = {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  status: string;
};

type EmailAssignment = {
  id: string;
  emailId: string;
  workspaceId: string;
  assignedToUserId: string;
  assignedByUserId: string;
  status: string;
  notes: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  open: { label: 'Open', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'secondary' },
  resolved: { label: 'Resolved', variant: 'outline' },
  transferred: { label: 'Transferred', variant: 'outline' },
};

export function EmailAssignmentPanel({
  threadId,
  workspaceId,
  className,
}: EmailAssignmentPanelProps) {
  const { toast } = useToast();
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');

  const { data: assignmentData, loading: assignmentLoading, refetch } = useQuery<{
    getEmailAssignment: EmailAssignment | null;
  }>(GET_EMAIL_ASSIGNMENT, {
    variables: { emailId: threadId },
    skip: !threadId,
    fetchPolicy: 'network-only',
  });

  const { data: membersData, loading: membersLoading } = useQuery<{
    workspaceMembers: WorkspaceMember[];
  }>(GET_WORKSPACE_MEMBERS, {
    variables: { workspaceId },
    skip: !workspaceId,
    fetchPolicy: 'cache-first',
  });

  const [assignEmail, { loading: assigning }] = useMutation(ASSIGN_EMAIL);
  const [transferEmail, { loading: transferring }] = useMutation(TRANSFER_EMAIL);
  const [resolveAssignment, { loading: resolving }] = useMutation(RESOLVE_EMAIL_ASSIGNMENT);

  const assignment = assignmentData?.getEmailAssignment;
  const members = membersData?.workspaceMembers ?? [];
  const isActive = assignment && ['open', 'in_progress'].includes(assignment.status);
  const isBusy = assigning || transferring || resolving;

  if (!workspaceId) return null;

  const handleAssign = async () => {
    if (!selectedMemberId) {
      toast({ title: 'Select a team member', variant: 'destructive' });
      return;
    }
    try {
      await assignEmail({
        variables: {
          input: {
            emailId: threadId,
            assigneeUserId: selectedMemberId,
            workspaceId,
            notes: notes || undefined,
            dueAt: dueAt || undefined,
          },
        },
      });
      toast({ title: 'Email assigned', description: 'Team member notified.' });
      setSelectedMemberId('');
      setNotes('');
      setDueAt('');
      refetch();
    } catch {
      toast({ title: 'Assignment failed', variant: 'destructive' });
    }
  };

  const handleTransfer = async () => {
    if (!selectedMemberId || !assignment) return;
    try {
      await transferEmail({
        variables: {
          input: {
            assignmentId: assignment.id,
            toUserId: selectedMemberId,
            notes: notes || undefined,
          },
        },
      });
      toast({ title: 'Email transferred' });
      setSelectedMemberId('');
      setNotes('');
      refetch();
    } catch {
      toast({ title: 'Transfer failed', variant: 'destructive' });
    }
  };

  const handleResolve = async () => {
    if (!assignment) return;
    try {
      await resolveAssignment({ variables: { assignmentId: assignment.id } });
      toast({ title: 'Resolved', description: 'Assignment marked as resolved.' });
      refetch();
    } catch {
      toast({ title: 'Resolve failed', variant: 'destructive' });
    }
  };

  return (
    <div className={cn('flex flex-col gap-4 p-4 border border-border/50 rounded-xl bg-card/50', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Assignment</span>
        {assignment && (
          <Badge
            variant={STATUS_BADGE[assignment.status]?.variant ?? 'outline'}
            className="ml-auto text-[10px] uppercase tracking-wide"
          >
            {STATUS_BADGE[assignment.status]?.label ?? assignment.status}
          </Badge>
        )}
      </div>

      {/* Current assignment summary */}
      {assignmentLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading…
        </div>
      ) : assignment ? (
        <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs space-y-0.5">
          <p className="text-muted-foreground">
            Assigned to: <span className="font-medium text-foreground">{assignment.assignedToUserId}</span>
          </p>
          {assignment.notes && (
            <p className="text-muted-foreground italic">&quot;{assignment.notes}&quot;</p>
          )}
          {assignment.dueAt && (
            <p className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Due {new Date(assignment.dueAt).toLocaleDateString()}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Not assigned to anyone yet.</p>
      )}

      {/* Member selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          {isActive ? 'Transfer to' : 'Assign to'}
        </Label>
        <Select
          value={selectedMemberId}
          onValueChange={setSelectedMemberId}
          disabled={membersLoading || isBusy}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={membersLoading ? 'Loading members…' : 'Select team member'} />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id} className="text-xs">
                {member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs">Handoff notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context for the assignee…"
          className="text-xs min-h-[60px] resize-none"
          disabled={isBusy}
        />
      </div>

      {/* Due date — only shown when creating a new assignment */}
      {!isActive && (
        <div className="space-y-1.5">
          <Label className="text-xs">Due date (optional)</Label>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            disabled={isBusy}
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {isActive ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs gap-1.5 flex-1"
              onClick={handleTransfer}
              disabled={!selectedMemberId || isBusy}
            >
              {transferring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Transfer
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-7 px-3 text-xs gap-1.5 flex-1"
              onClick={handleResolve}
              disabled={isBusy}
            >
              {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              Resolve
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="default"
            className="h-7 px-3 text-xs gap-1.5 w-full"
            onClick={handleAssign}
            disabled={!selectedMemberId || isBusy}
          >
            {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
            Assign
          </Button>
        )}
      </div>
    </div>
  );
}
