/**
 * File:        apps/frontend/app/(dashboard)/automations/new/page.tsx
 * Module:      Frontend · Automations · Create Page
 * Purpose:     Guided form for creating a new workspace automation. Allows selecting a
 *              trigger type, building a condition row list (ANDed together), and
 *              sequencing action steps. Submits via createAutomation mutation.
 *
 * Exports:
 *   - NewAutomationPage  — default export, Next.js App Router page component
 *
 * Depends on:
 *   - CREATE_AUTOMATION — from @/lib/apollo/queries/automations
 *   - DashboardPageShell — shared page wrapper
 *
 * Side-effects:
 *   - Apollo mutation writes to DB on submit
 *   - router.push('/automations/<id>') on success
 *
 * Key invariants:
 *   - At least one step is required before submission
 *   - workspaceId read from localStorage('mailzen.selectedWorkspaceId')
 *   - Conditions are optional — empty conditions list omits the `conditions` variable
 *   - Conditions are always joined with "all" (AND) — OR support is v1.1
 *
 * Read order:
 *   1. Types (TriggerType, ConditionField, ConditionOp, ActionType)
 *   2. TRIGGER_OPTIONS, CONDITION_FIELD_OPTIONS, CONDITION_OP_OPTIONS, ACTION_TYPE_OPTIONS
 *   3. ConditionRow, StepRow sub-components
 *   4. NewAutomationPage main component
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { ChevronLeft, Plus, Trash2, Zap } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { CREATE_AUTOMATION } from '@/lib/apollo/queries/automations';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TriggerType = 'email.received' | 'email.thread.replied' | 'email.thread.assigned' | 'email.label.added' | 'schedule.cron' | 'manual';
type ConditionField = 'from' | 'to' | 'subject' | 'labels';
type ConditionOp = 'contains' | 'equals' | 'starts_with' | 'ends_with';
type ActionType = 'email.label.add' | 'email.label.remove' | 'email.archive' | 'email.assign' | 'notify.user' | 'ai.classify';

type ConditionRow = {
  id: string;
  field: ConditionField;
  op: ConditionOp;
  value: string;
};

type StepRow = {
  id: string;
  type: ActionType;
  labelName?: string;
  title?: string;
  message?: string;
  targetUserId?: string;
};

// ─── Options ───────────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  { value: 'email.received',         label: 'Email received',       description: 'Fires when a new email arrives in the inbox' },
  { value: 'email.thread.replied',   label: 'Thread replied',       description: 'Fires when a reply is sent on a thread' },
  { value: 'email.thread.assigned',  label: 'Thread assigned',      description: 'Fires when a thread is assigned to a team member' },
  { value: 'email.label.added',      label: 'Label added',          description: 'Fires when a label is added to a thread' },
  { value: 'schedule.cron',          label: 'Scheduled (cron)',     description: 'Fires on a recurring schedule' },
  { value: 'manual',                 label: 'Manual trigger',       description: 'Only runs when manually triggered via the UI or API' },
];

const CONDITION_FIELD_OPTIONS: { value: ConditionField; label: string }[] = [
  { value: 'from',    label: 'From (sender)' },
  { value: 'to',     label: 'To (recipient)' },
  { value: 'subject', label: 'Subject' },
];

const CONDITION_OP_OPTIONS: { value: ConditionOp; label: string }[] = [
  { value: 'contains',    label: 'contains' },
  { value: 'equals',      label: 'equals' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with',   label: 'ends with' },
];

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string; hasLabel?: boolean; hasNotify?: boolean }[] = [
  { value: 'email.label.add',    label: 'Add label',      hasLabel: true },
  { value: 'email.label.remove', label: 'Remove label',   hasLabel: true },
  { value: 'email.archive',      label: 'Archive thread' },
  { value: 'email.assign',       label: 'Auto-assign thread' },
  { value: 'notify.user',        label: 'Notify user',    hasNotify: true },
  { value: 'ai.classify',        label: 'AI classify' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

let idSeq = 0;
const uid = () => String(++idSeq);

const buildStepPayload = (step: StepRow): Record<string, unknown> => {
  const base: Record<string, unknown> = { type: step.type };
  if (step.type === 'email.label.add' || step.type === 'email.label.remove') {
    base['labelName'] = step.labelName ?? '';
    base['createIfMissing'] = step.type === 'email.label.add';
  }
  if (step.type === 'notify.user') {
    base['title'] = step.title ?? '';
    base['message'] = step.message ?? '';
    if (step.targetUserId) base['targetUserId'] = step.targetUserId;
  }
  return base;
};

// ─── ConditionRowEditor ────────────────────────────────────────────────────────

interface ConditionRowEditorProps {
  row: ConditionRow;
  onChange: (row: ConditionRow) => void;
  onRemove: () => void;
}

function ConditionRowEditor({ row, onChange, onRemove }: ConditionRowEditorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={row.field} onValueChange={(v) => onChange({ ...row, field: v as ConditionField })}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONDITION_FIELD_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={row.op} onValueChange={(v) => onChange({ ...row, op: v as ConditionOp })}>
        <SelectTrigger className="w-28 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONDITION_OP_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8 text-xs flex-1 min-w-[120px]"
        placeholder="value…"
        value={row.value}
        onChange={(e) => onChange({ ...row, value: e.target.value })}
      />
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── StepRowEditor ─────────────────────────────────────────────────────────────

interface StepRowEditorProps {
  step: StepRow;
  index: number;
  onChange: (step: StepRow) => void;
  onRemove: () => void;
}

function StepRowEditor({ step, index, onChange, onRemove }: StepRowEditorProps) {
  const meta = ACTION_TYPE_OPTIONS.find((o) => o.value === step.type);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">{index + 1}.</span>
        <Select value={step.type} onValueChange={(v) => onChange({ ...step, type: v as ActionType, labelName: '', title: '', message: '' })}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {meta?.hasLabel && (
        <div className="pl-7">
          <Input
            className="h-8 text-xs"
            placeholder="Label name (e.g. urgent)"
            value={step.labelName ?? ''}
            onChange={(e) => onChange({ ...step, labelName: e.target.value })}
          />
        </div>
      )}
      {meta?.hasNotify && (
        <div className="pl-7 flex flex-col gap-1.5">
          <Input className="h-8 text-xs" placeholder="Notification title" value={step.title ?? ''} onChange={(e) => onChange({ ...step, title: e.target.value })} />
          <Input className="h-8 text-xs" placeholder="Notification message" value={step.message ?? ''} onChange={(e) => onChange({ ...step, message: e.target.value })} />
          <Input className="h-8 text-xs" placeholder="Target user ID (optional)" value={step.targetUserId ?? ''} onChange={(e) => onChange({ ...step, targetUserId: e.target.value })} />
        </div>
      )}
    </div>
  );
}

// ─── NewAutomationPage ─────────────────────────────────────────────────────────

export default function NewAutomationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('email.received');
  const [cronExpression, setCronExpression] = useState('0 9 * * 1-5');
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);

  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('mailzen.selectedWorkspaceId') : null;
    setWorkspaceId(id);
  }, []);

  const [createAutomation, { loading }] = useMutation(CREATE_AUTOMATION, {
    onCompleted: (data) => {
      toast({ title: 'Automation created', description: `"${name}" has been saved as a draft.` });
      const id = (data as { createAutomation: { id: string } }).createAutomation.id;
      router.push(`/automations/${id}`);
    },
    onError: (err) => {
      toast({ title: 'Failed to create', description: err.message, variant: 'destructive' });
    },
  });

  const addCondition = () =>
    setConditions((prev) => [...prev, { id: uid(), field: 'from', op: 'contains', value: '' }]);

  const updateCondition = (id: string, updated: ConditionRow) =>
    setConditions((prev) => prev.map((c) => (c.id === id ? updated : c)));

  const removeCondition = (id: string) =>
    setConditions((prev) => prev.filter((c) => c.id !== id));

  const addStep = () =>
    setSteps((prev) => [...prev, { id: uid(), type: 'email.label.add', labelName: '' }]);

  const updateStep = (id: string, updated: StepRow) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? updated : s)));

  const removeStep = (id: string) =>
    setSteps((prev) => prev.filter((s) => s.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) {
      toast({ title: 'No workspace selected', variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (steps.length === 0) {
      toast({ title: 'Add at least one action step', variant: 'destructive' });
      return;
    }

    const trigger: Record<string, unknown> = { type: triggerType };
    if (triggerType === 'schedule.cron') trigger['expression'] = cronExpression;

    const conditionLeaves = conditions.filter((c) => c.value.trim());
    const conditionsPayload =
      conditionLeaves.length === 0
        ? undefined
        : conditionLeaves.length === 1
          ? { field: conditionLeaves[0].field, op: conditionLeaves[0].op, value: conditionLeaves[0].value }
          : { all: conditionLeaves.map((c) => ({ field: c.field, op: c.op, value: c.value })) };

    await createAutomation({
      variables: {
        workspaceId,
        name: name.trim(),
        description: description.trim() || undefined,
        trigger,
        conditions: conditionsPayload,
        steps: steps.map(buildStepPayload),
      },
    });
  };

  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === triggerType);

  return (
    <DashboardPageShell
      title="New Automation"
      description="Define a trigger, optional conditions, and the actions to run."
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/automations">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="max-w-2xl space-y-6">

        {/* Name + Description */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-500" />
              Automation details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Boss emails → urgent label"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional — describe what this automation does"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Trigger */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">1. Trigger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <span className="font-medium">{t.label}</span>
                      <span className="text-muted-foreground text-xs ml-2">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTrigger && (
              <p className="text-xs text-muted-foreground">{selectedTrigger.description}</p>
            )}
            {triggerType === 'schedule.cron' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cron expression</Label>
                <Input
                  className="font-mono text-sm"
                  placeholder="0 9 * * 1-5"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Standard 5-field cron (minute hour dom month dow). Example: <code className="font-mono">0 9 * * 1-5</code> = weekdays at 9am.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conditions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">2. Conditions <span className="text-muted-foreground font-normal">(optional)</span></CardTitle>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addCondition}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add condition
              </Button>
            </div>
          </CardHeader>
          {conditions.length > 0 && (
            <CardContent className="pt-0 space-y-2">
              {conditions.map((row, i) => (
                <React.Fragment key={row.id}>
                  {i > 0 && <p className="text-xs text-muted-foreground font-medium px-1">AND</p>}
                  <ConditionRowEditor
                    row={row}
                    onChange={(updated) => updateCondition(row.id, updated)}
                    onRemove={() => removeCondition(row.id)}
                  />
                </React.Fragment>
              ))}
              {conditions.length > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  All conditions must match (AND logic). OR logic coming in v1.1.
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* Steps */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">3. Actions <span className="text-muted-foreground font-normal text-xs">(run in order)</span></CardTitle>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addStep}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add action
              </Button>
            </div>
          </CardHeader>
          {steps.length > 0 && (
            <CardContent className="pt-0 space-y-2">
              {steps.map((step, i) => (
                <StepRowEditor
                  key={step.id}
                  step={step}
                  index={i}
                  onChange={(updated) => updateStep(step.id, updated)}
                  onRemove={() => removeStep(step.id)}
                />
              ))}
            </CardContent>
          )}
          {steps.length === 0 && (
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">No actions yet — add at least one.</p>
            </CardContent>
          )}
        </Card>

        <Separator />

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={loading || !workspaceId || !name.trim() || steps.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? 'Saving…' : 'Save automation'}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/automations">Cancel</Link>
          </Button>
          <p className="text-xs text-muted-foreground ml-auto">Saved automations start as Draft — enable them from the detail page.</p>
        </div>
      </form>
    </DashboardPageShell>
  );
}
