'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { RefreshCw, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_SMART_REPLY_SETTINGS,
  UPDATE_SMART_REPLY_SETTINGS,
} from '@/lib/apollo/queries/smart-reply-settings';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';

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

const SmartRepliesSettingsPage = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SmartReplySettings>(DEFAULT_SETTINGS);

  const { data, loading, error, refetch } = useQuery(GET_SMART_REPLY_SETTINGS, {
    fetchPolicy: 'network-only',
  });

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
      description="Configure AI reply behavior and persist preferences in backend."
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

      <Alert className="bg-primary/5 border-primary/20">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertTitle>Live Settings</AlertTitle>
        <AlertDescription>
          These controls are now backed by GraphQL settings resolvers.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Core smart reply defaults and generation behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <p className="text-sm text-destructive">
              Failed to load settings: {error.message}
            </p>
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
        </CardContent>
        <CardFooter className="border-t flex items-center justify-between pt-4">
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
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
          <CardDescription>Custom instructions and retention preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </DashboardPageShell>
  );
};

export default SmartRepliesSettingsPage;
