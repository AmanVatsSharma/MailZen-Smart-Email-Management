/**
 * File:        apps/frontend/app/(dashboard)/settings/integrations/page.tsx
 * Module:      Frontend · Settings · Integrations
 * Purpose:     Workspace integrations settings page — install and manage Webhook
 *              (generic HMAC-signed outbound) and Slack (notify.slack action) integrations.
 *
 * Exports:
 *   - IntegrationsPage  — default Next.js page component
 *
 * Depends on:
 *   - GET_WEBHOOK_INTEGRATION          — query active webhook config
 *   - INSTALL_WEBHOOK_INTEGRATION      — mutation to install/rotate webhook
 *   - REVOKE_WEBHOOK_INTEGRATION       — mutation to revoke webhook
 *
 * Side-effects:
 *   - Calls GraphQL mutations on install/revoke
 *   - Shows plaintextSecret in a dialog — displayed ONCE, never again
 *
 * Key invariants:
 *   - plaintextSecret is shown in a dismissible alert; closing it hides it forever
 *   - workspaceId is read from localStorage (matching dashboard convention)
 *   - Slack install is a placeholder until T-INT-SLACK OAuth flow is wired
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Webhook, Slack, Copy, Check, AlertTriangle, Plug2, PlugZap } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_WEBHOOK_INTEGRATION,
  INSTALL_WEBHOOK_INTEGRATION,
  REVOKE_WEBHOOK_INTEGRATION,
} from '@/lib/apollo/queries/automations';

type WorkspaceIntegration = {
  id: string;
  provider: string;
  status: string;
  displayName: string;
  config: Record<string, unknown> | null;
  createdAt: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
    REVOKED: { label: 'Revoked', className: 'bg-red-100 text-red-700 border-red-200' },
    ERROR: { label: 'Error', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  };
  const { label, className } = map[status] ?? { label: status, className: '' };
  return <Badge className={className}>{label}</Badge>;
}

export default function IntegrationsPage() {
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspaceId') ?? '' : '';
  const { toast } = useToast();

  // ─── Webhook state ─────────────────────────────────────────────────────────
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [displayName, setDisplayName] = useState('My Webhook');
  const [plaintextSecret, setPlaintextSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  const { data: webhookData, loading: webhookLoading, refetch } = useQuery(GET_WEBHOOK_INTEGRATION, {
    variables: { workspaceId },
    skip: !workspaceId,
  });
  const webhookIntegration: WorkspaceIntegration | null = webhookData?.webhookIntegration ?? null;

  const [installWebhook, { loading: installing }] = useMutation(INSTALL_WEBHOOK_INTEGRATION, {
    onCompleted: (data) => {
      setPlaintextSecret(data.installWebhookIntegration.plaintextSecret);
      setWebhookDialogOpen(false);
      refetch();
      toast({ title: 'Webhook installed', description: 'Copy your signing secret — it will not be shown again.' });
    },
    onError: (e) => toast({ title: 'Install failed', description: e.message, variant: 'destructive' }),
  });

  const [revokeWebhook, { loading: revoking }] = useMutation(REVOKE_WEBHOOK_INTEGRATION, {
    onCompleted: () => {
      setRevokeDialogOpen(false);
      refetch();
      toast({ title: 'Webhook revoked' });
    },
    onError: (e) => toast({ title: 'Revoke failed', description: e.message, variant: 'destructive' }),
  });

  const handleInstall = () => {
    if (!webhookUrl.startsWith('https://')) {
      toast({ title: 'URL must start with https://', variant: 'destructive' });
      return;
    }
    installWebhook({ variables: { workspaceId, url: webhookUrl, displayName } });
  };

  const copySecret = async () => {
    if (!plaintextSecret) return;
    await navigator.clipboard.writeText(plaintextSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  return (
    <DashboardPageShell
      title="Integrations"
      description="Connect external services to use in automation actions."
    >
      <div className="max-w-2xl space-y-6">

        {/* One-time secret reveal */}
        {plaintextSecret && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Save your signing secret now</AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="text-amber-700 text-sm">This secret will never be shown again. Use it to verify the <code>X-MailZen-Signature</code> header on incoming webhooks.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white border px-3 py-2 text-sm font-mono break-all">
                  {plaintextSecret}
                </code>
                <Button size="sm" variant="outline" onClick={copySecret}>
                  {secretCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPlaintextSecret(null)}>
                I&apos;ve saved it — dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Webhook card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Webhook className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Generic Webhook</CardTitle>
                  <CardDescription className="text-sm">
                    Send automation events to any HTTPS endpoint. Signed with HMAC-SHA256.
                  </CardDescription>
                </div>
              </div>
              {webhookIntegration && <StatusBadge status={webhookIntegration.status} />}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {webhookLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : webhookIntegration?.status === 'ACTIVE' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{webhookIntegration.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  Target: <code className="font-mono text-xs">{(webhookIntegration.config?.['url'] as string) ?? '—'}</code>
                </p>
                <p className="text-xs text-muted-foreground">Installed {new Date(webhookIntegration.createdAt).toLocaleDateString()}</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setWebhookDialogOpen(true)}>
                    Rotate secret
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRevokeDialogOpen(true)}>
                    Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">No webhook configured.</p>
                <Button size="sm" onClick={() => setWebhookDialogOpen(true)}>
                  <PlugZap className="mr-2 h-4 w-4" />
                  Install
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slack card */}
        <Card className="opacity-75">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Slack className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Slack</CardTitle>
                  <CardDescription className="text-sm">
                    Post messages to channels or DMs from automation actions.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">Coming soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Slack OAuth install is being set up.</p>
              <Button size="sm" disabled>
                <Plug2 className="mr-2 h-4 w-4" />
                Connect Slack
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Install / rotate webhook dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {webhookIntegration?.status === 'ACTIVE' ? 'Rotate webhook secret' : 'Install webhook'}
            </DialogTitle>
            <DialogDescription>
              Enter the HTTPS URL that will receive signed POST requests from automation runs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>Target URL</Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInstall} disabled={installing || !webhookUrl}>
              {installing ? 'Installing…' : 'Install'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke webhook?</DialogTitle>
            <DialogDescription>
              This will immediately stop all webhook.post automation actions for this workspace.
              You can reinstall with a new secret at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => revokeWebhook({ variables: { workspaceId } })} disabled={revoking}>
              {revoking ? 'Revoking…' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
}
