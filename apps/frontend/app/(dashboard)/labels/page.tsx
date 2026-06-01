/**
 * File:        apps/frontend/app/(dashboard)/labels/page.tsx
 * Module:      Labels · Management Page
 * Purpose:     Dedicated page for viewing and creating email organisation labels.
 *
 * Exports:
 *   - LabelsPage (default) — page component rendering label list + creation dialog
 *
 * Depends on:
 *   - GET_ALL_LABELS, CREATE_LABEL — from emails.ts (organisation-level label operations)
 *   - DashboardPageShell          — standard page wrapper
 *
 * Side-effects:
 *   - Writes to backend label table via CREATE_LABEL mutation
 *
 * Key invariants:
 *   - Backend only supports create + list (no updateLabel / deleteLabel mutations exist)
 *   - GET_ALL_LABELS targets the organisation resolver; GET_LABELS targets unified-inbox (has count)
 *
 * Read order:
 *   1. LabelCard         — presentational chip used in the grid
 *   2. LabelsPage        — query/mutation wiring + dialog
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Plus, Tag } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { GET_ALL_LABELS, CREATE_LABEL } from '@/lib/apollo/queries/emails';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

type OrgLabel = { id: string; name: string; color?: string | null };

function LabelCard({ label }: { label: OrgLabel }) {
  const color = label.color ?? '#6366f1';
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}22`, color }}
      >
        <Tag className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{label.name}</p>
      </div>
      <Badge
        variant="outline"
        className="shrink-0 border-0 text-xs font-semibold"
        style={{ background: `${color}22`, color }}
      >
        {color}
      </Badge>
    </div>
  );
}

function LabelSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export default function LabelsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const { data, loading, error } = useQuery<{ getAllLabels: OrgLabel[] }>(GET_ALL_LABELS, {
    fetchPolicy: 'cache-and-network',
  });

  const [createLabel, { loading: creating }] = useMutation(CREATE_LABEL, {
    refetchQueries: [{ query: GET_ALL_LABELS }],
    onCompleted: () => {
      toast({ title: 'Label created', description: `"${name}" has been added.` });
      setDialogOpen(false);
      setName('');
      setColor(PRESET_COLORS[0]);
    },
    onError: (err) => {
      toast({ title: 'Failed to create label', description: err.message, variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createLabel({ variables: { name: trimmed, color } });
  };

  const labels = data?.getAllLabels ?? [];

  return (
    <DashboardPageShell
      title="Labels"
      description="Organise your inbox with colour-coded labels."
      actions={
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Label
        </Button>
      }
    >
      {error && (
        <p className="text-sm text-destructive">Failed to load labels: {error.message}</p>
      )}

      {loading && !data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <LabelSkeleton key={i} />)}
        </div>
      )}

      {!loading && labels.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Tag className="h-7 w-7 text-muted-foreground" />
          </span>
          <div>
            <p className="font-semibold">No labels yet</p>
            <p className="text-sm text-muted-foreground">Create your first label to start organising your inbox.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Label
          </Button>
        </div>
      )}

      {labels.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {labels.map((l) => <LabelCard key={l.id} label={l} />)}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Label</DialogTitle>
            <DialogDescription>Add a label to organise your email threads.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="label-name">Name</Label>
              <Input
                id="label-name"
                placeholder="e.g. Urgent, Client, Follow-up"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-7 w-7 rounded-full ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    style={{
                      background: c,
                      outline: color === c ? `3px solid ${c}` : 'none',
                      outlineOffset: 2,
                    }}
                    aria-label={c}
                  />
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">or</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded-full border border-border bg-transparent"
                    title="Custom colour"
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `${color}22`, color }}
                >
                  <Tag className="h-3 w-3" />
                  {name || 'Preview'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? 'Creating…' : 'Create Label'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
}
