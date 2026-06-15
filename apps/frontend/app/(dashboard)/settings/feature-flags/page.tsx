'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Plus, Shield, Trash2 } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/primitives/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_ALL_FEATURES,
  CREATE_FEATURE,
  UPDATE_FEATURE,
  DELETE_FEATURE,
} from '@/lib/apollo/queries/feature-flags';

const TARGET_TYPES = ['GLOBAL', 'ENVIRONMENT', 'WORKSPACE', 'USER', 'COHORT'];

type Feature = {
  id: string;
  name: string;
  targetType: string;
  targetValue?: string | null;
  rolloutPercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function FeatureFlagsPage() {
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Feature | null>(null);

  const [formName, setFormName] = useState('');
  const [formTargetType, setFormTargetType] = useState('GLOBAL');
  const [formTargetValue, setFormTargetValue] = useState('');
  const [formRollout, setFormRollout] = useState(100);

  const { data, loading, refetch } = useQuery(GET_ALL_FEATURES, {
    fetchPolicy: 'cache-and-network',
  });

  const [createFeature, { loading: creating }] = useMutation(CREATE_FEATURE, {
    onCompleted: () => {
      toast({ title: 'Feature flag created' });
      setSheetOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast({ title: 'Create failed', description: err.message, variant: 'destructive' }),
  });

  const [updateFeature] = useMutation(UPDATE_FEATURE, {
    onCompleted: () => refetch(),
    onError: (err) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const [deleteFeature, { loading: deleting }] = useMutation(DELETE_FEATURE, {
    onCompleted: () => {
      toast({ title: 'Feature flag deleted' });
      setDeleteTarget(null);
      refetch();
    },
    onError: (err) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  function resetForm() {
    setFormName('');
    setFormTargetType('GLOBAL');
    setFormTargetValue('');
    setFormRollout(100);
  }

  function handleCreate() {
    if (!formName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    createFeature({
      variables: {
        createFeatureInput: {
          name: formName,
          isActive: false,
          targetType: formTargetType,
          targetValue: formTargetValue || null,
          rolloutPercentage: formRollout,
        },
      },
    });
  }

  function toggleActive(feature: Feature) {
    updateFeature({
      variables: {
        updateFeatureInput: { id: feature.id, isActive: !feature.isActive },
      },
    });
  }

  const features: Feature[] = data?.getAllFeatures ?? [];

  return (
    <DashboardPageShell
      title="Feature Flags"
      description="Admin-only panel to manage platform feature rollouts"
      actions={
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Flag
        </Button>
      }
    >
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-0">
        {loading && features.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : features.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Shield className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No feature flags configured</p>
            <p className="text-xs">Create flags to control feature rollouts</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Target Type</TableHead>
                <TableHead>Target Value</TableHead>
                <TableHead>Rollout %</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium font-mono text-sm">{f.name}</TableCell>
                  <TableCell>
                    <StatusBadge status="info" label={f.targetType} className="text-xs" />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.targetValue ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">{f.rolloutPercentage}%</TableCell>
                  <TableCell>
                    <Switch
                      checked={f.isActive}
                      onCheckedChange={() => toggleActive(f)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(f)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New Feature Flag</SheetTitle>
            <SheetDescription>
              Configure targeting rules and rollout percentage for this feature.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="ff-name">Flag Name</Label>
              <Input
                id="ff-name"
                placeholder="e.g. new_inbox_layout"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="ff-target">Target Type</Label>
              <Select value={formTargetType} onValueChange={setFormTargetType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formTargetType !== 'GLOBAL' && (
              <div>
                <Label htmlFor="ff-value">Target Value</Label>
                <Input
                  id="ff-value"
                  placeholder="Workspace ID, user ID, or cohort name"
                  value={formTargetValue}
                  onChange={(e) => setFormTargetValue(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            )}
            <div>
              <Label htmlFor="ff-rollout">Rollout % ({formRollout}%)</Label>
              <Input
                id="ff-rollout"
                type="range"
                min={0}
                max={100}
                step={5}
                value={formRollout}
                onChange={(e) => setFormRollout(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create Flag'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete feature flag</DialogTitle>
            <DialogDescription>
              Delete <strong className="font-mono">{deleteTarget?.name}</strong>? This will
              immediately disable the flag for all targets.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deleteTarget && deleteFeature({ variables: { id: deleteTarget.id } })}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
}
