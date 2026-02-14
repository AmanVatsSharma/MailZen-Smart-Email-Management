'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Plus, Search, Trash2, Filter as FilterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const FiltersPage = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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

  const handleDeleteFilter = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Delete filter "${name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;
    await deleteFilter({ variables: { id } });
  };

  return (
    <DashboardPageShell
      title="Email Filters"
      description="Build automation rules backed by live backend resolvers."
      actions={(
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          Create Filter
        </Button>
      )}
      contentClassName="space-y-4"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Rules</CardTitle>
              <CardDescription>
                {filteredFilters.length} filter{filteredFilters.length === 1 ? '' : 's'}
              </CardDescription>
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
        </CardHeader>
        <CardContent>
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
                <div key={item.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">{item.name}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDeleteFilter(item.id, item.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.rules.map((rule, index) => (
                      <Badge key={`${item.id}-${index}`} variant="outline">
                        {rule.field} {rule.condition} {rule.value} {'->'} {rule.action}
                        {rule.actionValue ? ` (${rule.actionValue})` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              {creating ? 'Creating...' : 'Create Filter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
};

export default FiltersPage;
