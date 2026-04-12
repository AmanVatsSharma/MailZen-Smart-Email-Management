'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Edit2, Eye, FileText, Plus, Trash2 } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_EMAIL_TEMPLATES,
  RENDER_EMAIL_TEMPLATE,
  CREATE_EMAIL_TEMPLATE,
  UPDATE_EMAIL_TEMPLATE,
  DELETE_EMAIL_TEMPLATE,
} from '@/lib/apollo/queries/email-templates';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useLazyQuery } from '@apollo/client';

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
};

const VARIABLE_HINTS = [
  '{{recipient_name}}',
  '{{sender_name}}',
  '{{subject}}',
  '{{date}}',
  '{{company}}',
];

function TemplateSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-16 w-full" />
      </CardContent>
      <CardFooter className="gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </CardFooter>
    </Card>
  );
}

export default function TemplatesPage() {
  const { toast } = useToast();

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const { data, loading, refetch } = useQuery(GET_EMAIL_TEMPLATES, {
    fetchPolicy: 'cache-and-network',
  });

  const [renderTemplate, { loading: rendering }] = useLazyQuery(RENDER_EMAIL_TEMPLATE, {
    onCompleted: (d) => {
      setPreviewHtml(d.renderEmailTemplate ?? '');
      setPreviewOpen(true);
    },
  });

  const [createTemplate, { loading: creating }] = useMutation(CREATE_EMAIL_TEMPLATE, {
    onCompleted: () => {
      toast({ title: 'Template created' });
      setSheetOpen(false);
      refetch();
    },
    onError: (err) => toast({ title: 'Create failed', description: err.message, variant: 'destructive' }),
  });

  const [updateTemplate, { loading: updating }] = useMutation(UPDATE_EMAIL_TEMPLATE, {
    onCompleted: () => {
      toast({ title: 'Template updated' });
      setSheetOpen(false);
      refetch();
    },
    onError: (err) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const [deleteTemplate, { loading: deleting }] = useMutation(DELETE_EMAIL_TEMPLATE, {
    onCompleted: () => {
      toast({ title: 'Template deleted' });
      setDeleteTarget(null);
      refetch();
    },
    onError: (err) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  function openNew() {
    setEditingTemplate(null);
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setSheetOpen(true);
  }

  function openEdit(t: Template) {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBody(t.body);
    setSheetOpen(true);
  }

  function handleSave() {
    if (!formName.trim() || !formSubject.trim() || !formBody.trim()) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }
    if (editingTemplate) {
      updateTemplate({
        variables: {
          updateTemplateInput: {
            id: editingTemplate.id,
            name: formName,
            subject: formSubject,
            body: formBody,
          },
        },
      });
    } else {
      createTemplate({
        variables: {
          createTemplateInput: { name: formName, subject: formSubject, body: formBody },
        },
      });
    }
  }

  const templates: Template[] = data?.getEmailTemplates ?? [];
  const isSaving = creating || updating;

  return (
    <DashboardPageShell
      title="Email Templates"
      description="Create and manage reusable email templates with variable substitution"
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Template
        </Button>
      }
    >
      {loading && templates.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <TemplateSkeleton key={i} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <FileText className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-base font-medium">No templates yet</p>
          <p className="mb-5 text-sm">Create reusable templates to speed up email composition</p>
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{t.name}</p>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {formatDistanceToNow(parseISO(t.updatedAt), { addSuffix: true })}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">Subject: {t.subject}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="line-clamp-3 text-xs text-muted-foreground font-mono leading-relaxed bg-muted/30 rounded p-2">
                  {t.body}
                </p>
              </CardContent>
              <CardFooter className="gap-2 pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => renderTemplate({ variables: { id: t.id } })}
                  disabled={rendering}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEdit(t)}
                >
                  <Edit2 className="mr-1 h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(t)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</SheetTitle>
            <SheetDescription>
              Use {'{{'}'variable_name'{'}}'}  syntax for dynamic content substitution.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="tpl-name">Template Name</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Follow-up after meeting"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="tpl-subject">Subject Line</Label>
              <Input
                id="tpl-subject"
                placeholder="e.g. Following up on our conversation"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="tpl-body">Body</Label>
              <Textarea
                id="tpl-body"
                placeholder="Write your template body here..."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                className="mt-1.5 min-h-48 font-mono text-sm leading-relaxed"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Available variables:</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_HINTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => setFormBody((b) => b + v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>Rendered output with placeholder variables</DialogDescription>
          </DialogHeader>
          <div
            className="max-h-96 overflow-y-auto rounded-lg border bg-white p-4 text-sm dark:bg-neutral-900"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() =>
                deleteTarget && deleteTemplate({ variables: { id: deleteTarget.id } })
              }
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
}
