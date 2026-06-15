/**
 * File:        apps/frontend/app/(dashboard)/filters/page.tsx
 * Module:      Filters · Email Rule Management
 * Purpose:     Legacy rule-based inbox automation — create "when X, do Y" filters
 *              that run on incoming email server-side.
 *
 * Exports:
 *   - FiltersPage (default) — list + create dialog for email filter rules
 *
 * Depends on:
 *   - GET_EMAIL_FILTERS, CREATE_EMAIL_FILTER, DELETE_EMAIL_FILTER — from filters.ts
 *   - ConfirmDialog — delete confirmation (no window.confirm)
 *
 * Side-effects:
 *   - Apollo: reads filter list, writes via create/delete mutations
 *
 * Key invariants:
 *   - Filters are returned as JSON strings from the backend (parsed in-component)
 *   - Delete uses ConfirmDialog, not window.confirm — consistent with rest of app
 *
 * Read order:
 *   1. ACTION_LABELS / CONDITION_LABELS — display-name maps
 *   2. FiltersPage — query/mutation wiring and UI
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-07
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Plus, Search, Trash2, Filter as FilterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/primitives/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/composites/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CREATE_EMAIL_FILTER,
  DELETE_EMAIL_FILTER,
  GET_EMAIL_FILTERS,
} from '@/lib/apollo/queries/filters';
import { useToast } from '@/components/ui/use-toast';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';

type BackendRule = {
  field: string;
  condition: 'CONTAINS' | 'EQUALS' | 'STARTS_WITH' | 'ENDS_WITH';
  value: string;
  action:
    | 'MARK_READ'
    | 'MARK_IMPORTANT'
    | 'MOVE_TO_FOLDER'
    | 'APPLY_LABEL'
    | 'FORWARD_TO';
  actionValue?: string;
};

type BackendFilter = {
  id: string;
  name: string;
  rules: BackendRule[];
};

type FilterForm = {
  name: string;
  field: string;
  condition: BackendRule['condition'];
  value: string;
  action: BackendRule['action'];
  actionValue: string;
};

const DEFAULT_FORM: FilterForm = {
  name: '',
  field: 'subject',
  condition: 'CONTAINS',
  value: '',
  action: 'MARK_READ',
  actionValue: '',
};

const ACTIONS_REQUIRING_VALUE: BackendRule['action'][] = [
  'MOVE_TO_FOLDER',
  'APPLY_LABEL',
  'FORWARD_TO',
];

const ACTION_LABELS: Record<string, string> = {
  MARK_READ: 'Mark as read',
  MARK_IMPORTANT: 'Mark important',
  MOVE_TO_FOLDER: 'Move to folder',
  APPLY_LABEL: 'Apply label',
  FORWARD_TO: 'Forward to',
};

const CONDITION_LABELS: Record<string, string> = {
  CONTAINS: 'contains',
  EQUALS: 'equals',
  STARTS_WITH: 'starts with',
  ENDS_WITH: 'ends with',
};

const FiltersPage = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackendFilter | null>(null);
  const [form, setForm] = useState<FilterForm>(DEFAULT_FORM);

  const { data, loading, error, refetch } = useQuery(GET_EMAIL_FILTERS, {
    fetchPolicy: 'network-only',
  });

  const [createFilter, { loading: creating }] = useMutation(CREATE_EMAIL_FILTER, {
    onCompleted: async () => {
      await refetch();
      toast({
        title: 'Filter created',
        description: 'Your email filter is active now.',
      });
    },
  });

  const [deleteFilter] = useMutation(DELETE_EMAIL_FILTER, {
    onCompleted: async () => {
      await refetch();
      toast({
        title: 'Filter deleted',
        description: 'The filter has been removed.',
      });
    },
  });

  const filters: BackendFilter[] = useMemo(() => {
    const raw: string[] = data?.getEmailFilters ?? [];
    return raw
      .map((item) => {
        try {
          return JSON.parse(item) as BackendFilter;
        } catch {
          return null;
        }
      })
      .filter((item): item is BackendFilter => Boolean(item));
  }, [data]);

  const filteredFilters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filters;
    return filters.filter((item) =>
      [item.name, ...item.rules.map((r) => `${r.field} ${r.value}`)]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [filters, searchQuery]);

  const handleCreateFilter = async () => {
    const name = form.name.trim();
    const value = form.value.trim();
    const actionValue = form.actionValue.trim();

    if (!name || !value) {
      toast({
        title: 'Missing required fields',
        description: 'Filter name and condition value are required.',
        variant: 'destructive',
      });
      return;
    }

    if (ACTIONS_REQUIRING_VALUE.includes(form.action) && !actionValue) {
      toast({
        title: 'Missing action value',
        description: 'This action requires an additional value.',
        variant: 'destructive',
      });
      return;
    }

    await createFilter({
      variables: {
        input: {
          name,
          rules: [
            {
              field: form.field,
              condition: form.condition,
              value,
              action: form.action,
              actionValue:
                ACTIONS_REQUIRING_VALUE.includes(form.action) && actionValue
                  ? actionValue
                  : undefined,
            },
          ],
        },
      },
    });

    setCreateDialogOpen(false);
    setForm(DEFAULT_FORM);
  };

  const handleDeleteFilter = async (id: string) => {
    await deleteFilter({ variables: { id } });
    setDeleteTarget(null);
  };

  return (
    <DashboardPageShell
      title="Email Filters"
      description="Rules that automatically act on incoming mail — mark, move, label, or forward."
      actions={(
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          Create Filter
        </Button>
      )}
      contentClassName="space-y-4"
    >
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold leading-none tracking-tight">Rules</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredFilters.length} filter{filteredFilters.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="w-full max-w-sm">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search filters..."
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </div>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading filters...</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              Failed to load filters: {error.message}
            </p>
          ) : filteredFilters.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <FilterIcon className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No filters yet. Create one to automate inbox organization.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {filteredFilters.map((item) => (
                <div key={item.id} className="px-4 py-3 space-y-2 hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">{item.name}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete filter"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.rules.map((rule, index) => (
                      <span
                        key={`${item.id}-${index}`}
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal"
                      >
                        <span className="text-muted-foreground">{rule.field}</span>
                        &nbsp;{CONDITION_LABELS[rule.condition] ?? rule.condition}&nbsp;
                        <span className="font-medium">{rule.value}</span>
                        &nbsp;→&nbsp;
                        <span className="text-foreground">{ACTION_LABELS[rule.action] ?? rule.action}</span>
                        {rule.actionValue ? <span className="text-muted-foreground"> ({rule.actionValue})</span> : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Create Filter</DialogTitle>
            <DialogDescription>
              Define one rule now. You can add more advanced combinations later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="filter-name" className="text-sm font-medium">
                Filter name
              </label>
              <Input
                id="filter-name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Important client emails"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Field</label>
                <Select
                  value={form.field}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, field: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subject">Subject</SelectItem>
                    <SelectItem value="from">From</SelectItem>
                    <SelectItem value="to">To</SelectItem>
                    <SelectItem value="body">Body</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Condition</label>
                <Select
                  value={form.condition}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      condition: value as BackendRule['condition'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTAINS">CONTAINS</SelectItem>
                    <SelectItem value="EQUALS">EQUALS</SelectItem>
                    <SelectItem value="STARTS_WITH">STARTS_WITH</SelectItem>
                    <SelectItem value="ENDS_WITH">ENDS_WITH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Value</label>
                <Input
                  value={form.value}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, value: event.target.value }))
                  }
                  placeholder="example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Action</label>
                <Select
                  value={form.action}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      action: value as BackendRule['action'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARK_READ">MARK_READ</SelectItem>
                    <SelectItem value="MARK_IMPORTANT">MARK_IMPORTANT</SelectItem>
                    <SelectItem value="MOVE_TO_FOLDER">MOVE_TO_FOLDER</SelectItem>
                    <SelectItem value="APPLY_LABEL">APPLY_LABEL</SelectItem>
                    <SelectItem value="FORWARD_TO">FORWARD_TO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Action value (optional)</label>
                <Input
                  value={form.actionValue}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, actionValue: event.target.value }))
                  }
                  placeholder="Folder ID, Label ID or Email"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFilter} disabled={creating}>
              {creating ? 'Creating…' : 'Create Filter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete filter?"
        description={
          <>
            <strong>{deleteTarget?.name}</strong> will be permanently deleted. Emails that matched
            this filter will no longer be processed by it.
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && handleDeleteFilter(deleteTarget.id)}
      />
    </DashboardPageShell>
  );
};

export default FiltersPage;
