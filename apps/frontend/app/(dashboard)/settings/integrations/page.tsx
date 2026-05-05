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
 *   - GET_WEBHOOK_INTEGRATION / INSTALL_WEBHOOK_INTEGRATION / REVOKE_WEBHOOK_INTEGRATION
 *   - GET_SLACK_INTEGRATION / GET_SLACK_CHANNELS / GET_SLACK_INSTALL_URL
 *   - REVOKE_SLACK_INTEGRATION / SET_SLACK_DEFAULT_CHANNEL
 *
 * Side-effects:
 *   - "Connect Slack" navigates the browser to the backend OAuth redirect
 *   - Reads ?slack=connected|error|denied from URL on mount to show toast
 *   - plaintextSecret is displayed once in a dismissible alert
 *
 * Key invariants:
 *   - workspaceId is read from localStorage (matching dashboard convention)
 *   - Slack OAuth is a server-side redirect — not a GraphQL mutation
 *   - Channel picker only renders when Slack integration is ACTIVE
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import {
  Webhook,
  Slack,
  Copy,
  Check,
  AlertTriangle,
  Plug2,
  PlugZap,
  Hash,
  Lock,
  ChevronDown,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_WEBHOOK_INTEGRATION,
  INSTALL_WEBHOOK_INTEGRATION,
  REVOKE_WEBHOOK_INTEGRATION,
  GET_SLACK_INTEGRATION,
  GET_SLACK_CHANNELS,
  REVOKE_SLACK_INTEGRATION,
  SET_SLACK_DEFAULT_CHANNEL,
} from '@/lib/apollo/queries/automations';

type WorkspaceIntegration = {
  id: string;
  provider: string;
  status: string;
  displayName: string | null;
  config: Record<string, unknown> | null;
  createdAt: string;
};

type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
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

const apiBase =
  (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ?? 'http://localhost:4000/graphql').replace(
    '/graphql',
    '',
  );

export default function IntegrationsPage() {
  const workspaceId =
    typeof window !== 'undefined' ? (localStorage.getItem('workspaceId') ?? '') : '';
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // ─── Show toast after Slack OAuth callback ────────────────────────────────
  useEffect(() => {
    const slackResult = searchParams.get('slack');
    if (!slackResult) return;
    if (slackResult === 'connected') {
      toast({ title: 'Slack connected', description: 'Your workspace is now linked to Slack.' });
    } else if (slackResult === 'denied') {
      toast({ title: 'Slack connection cancelled', variant: 'destructive' });
    } else if (slackResult === 'error') {
      toast({ title: 'Slack connection failed', description: 'Please try again.', variant: 'destructive' });
    }
    // Remove query param from URL without re-render
    const url = new URL(window.location.href);
    url.searchParams.delete('slack');
    url.searchParams.delete('workspaceId');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams, toast]);

  // ─── Webhook state ─────────────────────────────────────────────────────────
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [revokeWebhookDialogOpen, setRevokeWebhookDialogOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDisplayName, setWebhookDisplayName] = useState('My Webhook');
  const [plaintextSecret, setPlaintextSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  const { data: webhookData, loading: webhookLoading, refetch: refetchWebhook } = useQuery(
    GET_WEBHOOK_INTEGRATION,
    { variables: { workspaceId }, skip: !workspaceId },
  );
  const webhookIntegration: WorkspaceIntegration | null =
    webhookData?.webhookIntegration ?? null;

  const [installWebhook, { loading: installing }] = useMutation(INSTALL_WEBHOOK_INTEGRATION, {
    onCompleted: (data) => {
      setPlaintextSecret(data.installWebhookIntegration.plaintextSecret);
      setWebhookDialogOpen(false);
      refetchWebhook();
      toast({
        title: 'Webhook installed',
        description: 'Copy your signing secret — it will not be shown again.',
      });
    },
    onError: (e) =>
      toast({ title: 'Install failed', description: e.message, variant: 'destructive' }),
  });

  const [revokeWebhook, { loading: revokingWebhook }] = useMutation(
    REVOKE_WEBHOOK_INTEGRATION,
    {
      onCompleted: () => {
        setRevokeWebhookDialogOpen(false);
        refetchWebhook();
        toast({ title: 'Webhook revoked' });
      },
      onError: (e) =>
        toast({ title: 'Revoke failed', description: e.message, variant: 'destructive' }),
    },
  );

  const handleInstallWebhook = () => {
    if (!webhookUrl.startsWith('https://')) {
      toast({ title: 'URL must start with https://', variant: 'destructive' });
      return;
    }
    installWebhook({
      variables: { workspaceId, url: webhookUrl, displayName: webhookDisplayName },
    });
  };

  const copySecret = async () => {
    if (!plaintextSecret) return;
    await navigator.clipboard.writeText(plaintextSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  // ─── Slack state ────────────────────────────────────────────────────────────
  const [revokeSlackDialogOpen, setRevokeSlackDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);

  const { data: slackData, loading: slackLoading, refetch: refetchSlack } = useQuery(
    GET_SLACK_INTEGRATION,
    { variables: { workspaceId }, skip: !workspaceId },
  );
  const slackIntegration: WorkspaceIntegration | null = slackData?.slackIntegration ?? null;
  const slackActive = slackIntegration?.status === 'ACTIVE';

  const { data: channelsData, loading: channelsLoading } = useQuery(GET_SLACK_CHANNELS, {
    variables: { workspaceId },
    skip: !slackActive,
  });
  const channels: SlackChannel[] = channelsData?.slackChannels ?? [];

  const defaultChannel = slackIntegration?.config?.['defaultChannel'] as
    | { id: string; name: string }
    | undefined;

  const [revokeSlack, { loading: revokingSlack }] = useMutation(REVOKE_SLACK_INTEGRATION, {
    onCompleted: () => {
      setRevokeSlackDialogOpen(false);
      refetchSlack();
      toast({ title: 'Slack disconnected' });
    },
    onError: (e) =>
      toast({ title: 'Disconnect failed', description: e.message, variant: 'destructive' }),
  });

  const [setDefaultChannel, { loading: savingChannel }] = useMutation(
    SET_SLACK_DEFAULT_CHANNEL,
    {
      onCompleted: () => {
        refetchSlack();
        toast({ title: 'Default channel saved' });
        setSelectedChannel(null);
      },
      onError: (e) =>
        toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
    },
  );

  const handleConnectSlack = () => {
    window.location.href = `${apiBase}/integrations/slack/install?workspaceId=${workspaceId}`;
  };

  const handleSaveChannel = () => {
    if (!selectedChannel) return;
    setDefaultChannel({
      variables: {
        workspaceId,
        channelId: selectedChannel.id,
        channelName: selectedChannel.name,
      },
    });
  };

  return (
    <DashboardPageShell
      title="Integrations"
      description="Connect external services to use in automation actions."
    >
      <div className="max-w-2xl space-y-6">

        {/* One-time webhook secret reveal */}
        {plaintextSecret && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Save your signing secret now</AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="text-amber-700 text-sm">
                This secret will never be shown again. Use it to verify the{' '}
                <code>X-MailZen-Signature</code> header on incoming webhooks.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white border px-3 py-2 text-sm font-mono break-all">
                  {plaintextSecret}
                </code>
                <Button size="sm" variant="outline" onClick={copySecret}>
                  {secretCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
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
              <Skeleton className="h-8 w-full" />
            ) : webhookIntegration?.status === 'ACTIVE' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{webhookIntegration.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  Target:{' '}
                  <code className="font-mono text-xs">
                    {(webhookIntegration.config?.['url'] as string) ?? '—'}
                  </code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Installed {new Date(webhookIntegration.createdAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWebhookDialogOpen(true)}
                  >
                    Rotate secret
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setRevokeWebhookDialogOpen(true)}
                  >
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
        <Card>
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
              {slackIntegration && <StatusBadge status={slackIntegration.status} />}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {slackLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : slackActive ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{slackIntegration!.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {new Date(slackIntegration!.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Default channel picker */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Default channel</Label>
                  {channelsLoading ? (
                    <Skeleton className="h-8 w-48" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-48 justify-between">
                            <span className="flex items-center gap-1.5 truncate">
                              {(selectedChannel ?? defaultChannel) ? (
                                <>
                                  {(selectedChannel?.isPrivate ?? false) ? (
                                    <Lock className="h-3.5 w-3.5 shrink-0" />
                                  ) : (
                                    <Hash className="h-3.5 w-3.5 shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {selectedChannel?.name ?? defaultChannel?.name}
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">Pick a channel…</span>
                              )}
                            </span>
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 w-48 overflow-y-auto">
                          {channels.length === 0 ? (
                            <DropdownMenuItem disabled>No channels found</DropdownMenuItem>
                          ) : (
                            channels.map((ch) => (
                              <DropdownMenuItem
                                key={ch.id}
                                onClick={() => setSelectedChannel(ch)}
                                className="flex items-center gap-1.5"
                              >
                                {ch.isPrivate ? (
                                  <Lock className="h-3.5 w-3.5" />
                                ) : (
                                  <Hash className="h-3.5 w-3.5" />
                                )}
                                {ch.name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {selectedChannel && selectedChannel.id !== defaultChannel?.id && (
                        <Button
                          size="sm"
                          onClick={handleSaveChannel}
                          disabled={savingChannel}
                        >
                          {savingChannel ? 'Saving…' : 'Save'}
                        </Button>
                      )}
                    </div>
                  )}
                  {defaultChannel && !selectedChannel && (
                    <p className="text-xs text-muted-foreground">
                      Automations using <code>notify.slack</code> without an explicit channel
                      will post here.
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleConnectSlack}>
                    Reconnect
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setRevokeSlackDialogOpen(true)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {slackIntegration?.status === 'REVOKED'
                    ? 'Slack was disconnected.'
                    : 'Not connected to Slack.'}
                </p>
                <Button size="sm" onClick={handleConnectSlack}>
                  <Plug2 className="mr-2 h-4 w-4" />
                  Connect Slack
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Install / rotate webhook dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {webhookIntegration?.status === 'ACTIVE'
                ? 'Rotate webhook secret'
                : 'Install webhook'}
            </DialogTitle>
            <DialogDescription>
              Enter the HTTPS URL that will receive signed POST requests from automation runs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={webhookDisplayName}
                onChange={(e) => setWebhookDisplayName(e.target.value)}
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
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInstallWebhook}
              disabled={installing || !webhookUrl}
            >
              {installing ? 'Installing…' : 'Install'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke webhook dialog */}
      <Dialog open={revokeWebhookDialogOpen} onOpenChange={setRevokeWebhookDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke webhook?</DialogTitle>
            <DialogDescription>
              This will immediately stop all <code>webhook.post</code> automation actions for
              this workspace. You can reinstall with a new secret at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeWebhookDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeWebhook({ variables: { workspaceId } })}
              disabled={revokingWebhook}
            >
              {revokingWebhook ? 'Revoking…' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Slack dialog */}
      <Dialog open={revokeSlackDialogOpen} onOpenChange={setRevokeSlackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Slack?</DialogTitle>
            <DialogDescription>
              All <code>notify.slack</code> automation actions will stop working until you
              reconnect. Your Slack workspace data is not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeSlackDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeSlack({ variables: { workspaceId } })}
              disabled={revokingSlack}
            >
              {revokingSlack ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
}
