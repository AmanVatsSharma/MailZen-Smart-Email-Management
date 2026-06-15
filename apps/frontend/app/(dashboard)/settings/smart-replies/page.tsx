'use client';

import React, { useEffect, useState } from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import {
  Activity,
  Bot,
  CheckCircle2,
  Database,
  Download,
  History,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { StatusBadge } from '@/components/primitives/status-badge';
import { InlineError } from '@/components/primitives/inline-error';
import {
  GET_SMART_REPLY_SETTINGS,
  UPDATE_SMART_REPLY_SETTINGS,
} from '@/lib/apollo/queries/smart-reply-settings';
import {
  GET_MY_PROFILE,
  UPDATE_AUTO_SEND_TIER,
} from '@/lib/apollo/queries/agent-assistant';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  GET_SMART_REPLY_DATA_EXPORT,
  GET_SMART_REPLY_HISTORY,
  GET_SMART_REPLY_PROVIDER_HEALTH,
  PURGE_SMART_REPLY_HISTORY,
} from '@/lib/apollo/queries/smart-reply-history';

type SmartReplySettings = {
  enabled: boolean;
  defaultTone: string;
  defaultLength: string;
  aiModel: string;
  includeSignature: boolean;
  personalization: number;
  creativityLevel: number;
  maxSuggestions: number;
  customInstructions?: string | null;
  keepHistory: boolean;
  historyLength: number;
};

const DEFAULT_SETTINGS: SmartReplySettings = {
  enabled: true,
  defaultTone: 'professional',
  defaultLength: 'medium',
  aiModel: 'balanced',
  includeSignature: true,
  personalization: 75,
  creativityLevel: 60,
  maxSuggestions: 3,
  customInstructions: '',
  keepHistory: true,
  historyLength: 30,
};

type AutoSendTierValue = 'MANUAL' | 'SEMI_AUTO' | 'AUTO';

type SmartReplyProviderHealthRow = {
  providerId: string;
  enabled: boolean;
  configured: boolean;
  priority?: number | null;
  note?: string | null;
};

type SmartReplyProviderHealthPayload = {
  mode: string;
  hybridPrimary: string;
  executedAtIso: string;
  providers: SmartReplyProviderHealthRow[];
};

type SmartReplyHistoryRow = {
  id: string;
  conversationPreview: string;
  suggestions: string[];
  source: string;
  blockedSensitive: boolean;
  fallbackUsed: boolean;
  createdAt: string;
};

const AUTO_SEND_TIERS: { value: AutoSendTierValue; label: string; description: string; badge?: string }[] = [
  {
    value: 'MANUAL',
    label: 'Manual (Default)',
    description: 'Every AI-composed draft is shown for your review before sending. You stay fully in control.',
  },
  {
    value: 'SEMI_AUTO',
    label: 'Semi-Automatic',
    description: 'Short drafts (≤120 words) for low-stakes threads (coordination / commercial + low/medium priority) are auto-approved.',
    badge: 'Smart',
  },
  {
    value: 'AUTO',
    label: 'Fully Automatic',
    description: 'All AI-composed drafts are auto-approved without review. Use with caution.',
    badge: 'Power',
  },
];

const SmartRepliesSettingsPage = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SmartReplySettings>(DEFAULT_SETTINGS);
  const [autoSendTier, setAutoSendTier] = useState<AutoSendTierValue>('MANUAL');
  const [purgeOpen, setPurgeOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_SMART_REPLY_SETTINGS, {
    fetchPolicy: 'network-only',
  });

  const { data: profileData } = useQuery<{ myProfile?: { id: string; autoSendTier?: string } | null }>(
    GET_MY_PROFILE,
    { fetchPolicy: 'cache-first' },
  );

  const [updateAutoSendTierMutation, { loading: savingTier }] = useMutation(UPDATE_AUTO_SEND_TIER, {
    onCompleted: () => {
      toast({
        title: 'Auto-send tier saved',
        description: 'Your AI draft auto-send preference has been updated.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Failed to update tier',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const { data: healthData, loading: healthLoading } = useQuery<{
    mySmartReplyProviderHealth: SmartReplyProviderHealthPayload;
  }>(GET_SMART_REPLY_PROVIDER_HEALTH, {
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: historyData,
    loading: historyLoading,
    refetch: refetchHistory,
  } = useQuery<{ mySmartReplyHistory: SmartReplyHistoryRow[] }>(GET_SMART_REPLY_HISTORY, {
    variables: { limit: 40 },
    fetchPolicy: 'network-only',
  });

  const [fetchExport, { loading: exportLoading }] = useLazyQuery(GET_SMART_REPLY_DATA_EXPORT, {
    fetchPolicy: 'network-only',
  });

  const [purgeHistory, { loading: purging }] = useMutation(PURGE_SMART_REPLY_HISTORY, {
    onCompleted: async (payload) => {
      const rows = payload?.purgeMySmartReplyHistory?.purgedRows ?? 0;
      toast({ title: 'History cleared', description: `Removed ${rows} record(s).` });
      setPurgeOpen(false);
      await refetchHistory();
    },
    onError: (err) => {
      toast({ title: 'Purge failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleDownloadExport = async () => {
    const res = await fetchExport({ variables: { limit: 500 } });
    const exp = res.data?.mySmartReplyDataExport;
    if (!exp?.dataJson) {
      toast({ title: 'Export failed', description: 'No data returned.', variant: 'destructive' });
      return;
    }
    const blob = new Blob([exp.dataJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailzen-smart-reply-export-${exp.generatedAtIso || 'data'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Download started', description: 'Smart reply export saved as JSON.' });
  };

  const [updateSettings, { loading: saving }] = useMutation(UPDATE_SMART_REPLY_SETTINGS, {
    onCompleted: async () => {
      await refetch();
      toast({
        title: 'Settings saved',
        description: 'Smart reply settings were updated successfully.',
      });
    },
  });

  useEffect(() => {
    const serverSettings = data?.smartReplySettings;
    if (!serverSettings) return;
    setSettings({
      enabled: serverSettings.enabled,
      defaultTone: serverSettings.defaultTone,
      defaultLength: serverSettings.defaultLength,
      aiModel: serverSettings.aiModel,
      includeSignature: serverSettings.includeSignature,
      personalization: serverSettings.personalization,
      creativityLevel: serverSettings.creativityLevel,
      maxSuggestions: serverSettings.maxSuggestions,
      customInstructions: serverSettings.customInstructions ?? '',
      keepHistory: serverSettings.keepHistory,
      historyLength: serverSettings.historyLength,
    });
  }, [data]);

  useEffect(() => {
    const tier = profileData?.myProfile?.autoSendTier;
    if (tier === 'MANUAL' || tier === 'SEMI_AUTO' || tier === 'AUTO') {
      setAutoSendTier(tier);
    }
  }, [profileData]);

  const handleSave = async () => {
    await updateSettings({
      variables: {
        input: {
          enabled: settings.enabled,
          defaultTone: settings.defaultTone,
          defaultLength: settings.defaultLength,
          aiModel: settings.aiModel,
          includeSignature: settings.includeSignature,
          personalization: settings.personalization,
          creativityLevel: settings.creativityLevel,
          maxSuggestions: settings.maxSuggestions,
          customInstructions: settings.customInstructions || '',
          keepHistory: settings.keepHistory,
          historyLength: settings.historyLength,
        },
      },
    });
  };

  return (
    <DashboardPageShell
      title="Smart Replies Settings"
      description="Tune how MailZen drafts AI replies — tone, length, and auto-send threshold."
      actions={(
        <Button onClick={handleSave} className="gap-1" disabled={saving || loading}>
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      )}
      contentClassName="max-w-4xl space-y-6"
    >

      <div role="alert" className="rounded-lg border border-primary/20 bg-primary/5">
        <h4 className="font-medium mb-1">Live Settings</h4>
        <p className="text-sm">These controls are now backed by GraphQL settings resolvers.</p>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <div className="flex flex-col gap-1.5 p-6 relative z-10">
          <h3 className="leading-none font-semibold">General</h3>
          <p className="text-sm text-muted-foreground">Core smart reply defaults and generation behavior.</p>
        </div>
        <div className="p-6 space-y-6">
          {error && (
            <InlineError error={new Error(error.message)} />
          )}

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Enable Smart Replies</h3>
              <p className="text-sm text-muted-foreground">
                Toggle AI suggestions in compose and reply flows.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Default Tone</label>
              <Select
                value={settings.defaultTone}
                onValueChange={(value) =>
                  setSettings((prev) => ({ ...prev, defaultTone: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Default Length</label>
              <Select
                value={settings.defaultLength}
                onValueChange={(value) =>
                  setSettings((prev) => ({ ...prev, defaultLength: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">AI Model</label>
              <Select
                value={settings.aiModel}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, aiModel: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="accurate">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Suggestions Count</label>
              <Select
                value={String(settings.maxSuggestions)}
                onValueChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    maxSuggestions: Number(value),
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Personalization</label>
              <span className="text-sm">{settings.personalization}%</span>
            </div>
            <Slider
              value={[settings.personalization]}
              max={100}
              step={1}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, personalization: value[0] }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Creativity</label>
              <span className="text-sm">{settings.creativityLevel}%</span>
            </div>
            <Slider
              value={[settings.creativityLevel]}
              max={100}
              step={1}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, creativityLevel: value[0] }))
              }
            />
          </div>
        </div>
        <div className="border-t flex items-center justify-between p-6 pt-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.includeSignature}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, includeSignature: checked }))
              }
            />
            <span className="text-sm">Include signature</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.keepHistory}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, keepHistory: checked }))
              }
            />
            <span className="text-sm">Keep reply history</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <div className="flex flex-col gap-1.5 p-6 relative z-10">
          <h3 className="leading-none font-semibold">Advanced</h3>
          <p className="text-sm text-muted-foreground">Custom instructions and retention preferences.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium">History duration (days)</label>
            <Select
              value={String(settings.historyLength)}
              onValueChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  historyLength: Number(value),
                }))
              }
            >
              <SelectTrigger className="mt-1 max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="90">90</SelectItem>
                <SelectItem value="365">365</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Custom instructions</label>
            <Textarea
              value={settings.customInstructions ?? ''}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  customInstructions: event.target.value,
                }))
              }
              placeholder="Example: keep responses concise and solution-oriented."
              className="mt-1 min-h-[120px]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <div className="flex flex-col gap-1.5 p-6 relative z-10">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <h3 className="leading-none font-semibold">Smart reply provider status</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Routing mode and which LLM backends are configured. Useful when you only see template replies.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {healthLoading ? (
            <p className="text-sm text-muted-foreground">Loading provider health…</p>
          ) : healthData?.mySmartReplyProviderHealth ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <StatusBadge status="info" label={`Mode: ${healthData.mySmartReplyProviderHealth.mode}`} />
                <StatusBadge status="info" label={`Hybrid primary: ${healthData.mySmartReplyProviderHealth.hybridPrimary}`} />
                <span className="text-xs text-muted-foreground">
                  Checked {new Date(healthData.mySmartReplyProviderHealth.executedAtIso).toLocaleString()}
                </span>
              </div>
              <ul className="space-y-2 rounded-md border border-border/60 p-3 text-sm">
                {healthData.mySmartReplyProviderHealth.providers.map((p) => (
                  <li key={p.providerId} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{p.providerId}</span>
                    <span className="text-muted-foreground">
                      {p.configured ? 'configured' : 'not configured'}
                      {' · '}
                      {p.enabled ? 'enabled' : 'disabled'}
                      {typeof p.priority === 'number' ? ` · priority ${p.priority}` : ''}
                    </span>
                    {p.note ? <p className="w-full text-xs text-muted-foreground">{p.note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Provider health unavailable.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <div className="flex flex-col gap-1.5 p-6 relative z-10">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <div>
              <h3 className="leading-none font-semibold">Generation history</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Recent smart-reply generations stored for your account. Export or clear for privacy.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void handleDownloadExport()}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download JSON export
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setPurgeOpen(true)}
              disabled={purging}
            >
              <Trash2 className="h-4 w-4" />
              Clear history
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => void refetchHistory()}
            >
              <Database className="h-4 w-4" />
              Refresh list
            </Button>
          </div>

          <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear smart reply history?</DialogTitle>
                <DialogDescription>
                  This removes stored generation history for your account. Your current settings are not affected.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setPurgeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={purging}
                  onClick={() => void purgeHistory()}
                >
                  {purging ? 'Clearing…' : 'Clear history'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border/60 p-2 text-sm">
              {(historyData?.mySmartReplyHistory ?? []).length === 0 ? (
                <li className="p-3 text-muted-foreground">No history entries yet.</li>
              ) : (
                (historyData?.mySmartReplyHistory ?? []).map((row) => (
                  <li key={row.id} className="rounded-md border border-border/40 p-2">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{row.conversationPreview}</p>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                      <span>{new Date(row.createdAt).toLocaleString()}</span>
                      <span>·</span>
                      <span>{row.source}</span>
                      {row.fallbackUsed ? <StatusBadge status="warning" label="fallback" /> : null}
                      {row.blockedSensitive ? <StatusBadge status="error" label="blocked" /> : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Auto-Send Trust Tier */}
      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <div className="flex flex-col gap-1.5 p-6 relative z-10">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <h3 className="leading-none font-semibold">AI Draft Auto-Send Tier</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Control how much trust you grant to AI-composed reply drafts. Higher tiers reduce friction for low-stakes conversations.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-3">
          {AUTO_SEND_TIERS.map((tier) => {
            const isSelected = autoSendTier === tier.value;
            return (
              <button
                key={tier.value}
                type="button"
                onClick={() => setAutoSendTier(tier.value)}
                className={`w-full rounded-lg border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{tier.label}</span>
                        {tier.badge && (
                          <StatusBadge status="info" label={tier.badge} className="text-[10px]" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tier.description}</p>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                </div>
              </button>
            );
          })}

          {autoSendTier === 'AUTO' && (
            <div role="alert" className="rounded-lg border border-yellow-500/30 bg-yellow-500/5">
              <h4 className="font-medium mb-1 text-yellow-600 dark:text-yellow-400">Heads up</h4>
              <p className="text-xs">
                Fully Automatic mode auto-approves every AI draft. Make sure your AI is well-calibrated before enabling this.
              </p>
            </div>
          )}
        </div>
        <div className="p-6 border-t">
          <Button
            onClick={() => updateAutoSendTierMutation({ variables: { tier: autoSendTier } })}
            disabled={savingTier}
            className="gap-2"
            variant="outline"
          >
            {savingTier ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Auto-Send Tier
          </Button>
        </div>
      </div>
    </DashboardPageShell>
  );
};

export default SmartRepliesSettingsPage;