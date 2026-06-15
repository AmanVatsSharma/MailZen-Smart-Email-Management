'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { RefreshCw, Save } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { InlineError } from '@/components/primitives/inline-error';
import {
  GET_NOTIFICATION_PREFERENCES,
  UPDATE_NOTIFICATION_PREFERENCES,
} from '@/lib/apollo/queries/notifications';

type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  syncFailureEnabled: boolean;
  mailboxInboundAcceptedEnabled: boolean;
  mailboxInboundDeduplicatedEnabled: boolean;
  mailboxInboundRejectedEnabled: boolean;
  mailboxInboundSlaTargetSuccessPercent: number;
  mailboxInboundSlaWarningRejectedPercent: number;
  mailboxInboundSlaCriticalRejectedPercent: number;
  mailboxInboundSlaAlertsEnabled: boolean;
  notificationDigestEnabled: boolean;
  mailboxInboundSlaAlertCooldownMinutes: number;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: false,
  syncFailureEnabled: true,
  mailboxInboundAcceptedEnabled: true,
  mailboxInboundDeduplicatedEnabled: false,
  mailboxInboundRejectedEnabled: true,
  mailboxInboundSlaTargetSuccessPercent: 99,
  mailboxInboundSlaWarningRejectedPercent: 1,
  mailboxInboundSlaCriticalRejectedPercent: 5,
  mailboxInboundSlaAlertsEnabled: true,
  notificationDigestEnabled: true,
  mailboxInboundSlaAlertCooldownMinutes: 60,
};

const NotificationsSettingsPage = () => {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_PREFERENCES,
  );

  const { data, loading, error, refetch } = useQuery(GET_NOTIFICATION_PREFERENCES, {
    fetchPolicy: 'network-only',
  });

  const [updatePreferences, { loading: saving }] = useMutation(
    UPDATE_NOTIFICATION_PREFERENCES,
    {
      onCompleted: async () => {
        await refetch();
        toast({
          title: 'Notification settings saved',
          description: 'Your notification delivery preferences were updated.',
        });
      },
    },
  );

  useEffect(() => {
    const serverPreferences = data?.myNotificationPreferences;
    if (!serverPreferences) return;
    setPreferences({
      inAppEnabled: serverPreferences.inAppEnabled,
      emailEnabled: serverPreferences.emailEnabled,
      pushEnabled: serverPreferences.pushEnabled,
      syncFailureEnabled: serverPreferences.syncFailureEnabled,
      mailboxInboundAcceptedEnabled:
        serverPreferences.mailboxInboundAcceptedEnabled,
      mailboxInboundDeduplicatedEnabled:
        serverPreferences.mailboxInboundDeduplicatedEnabled,
      mailboxInboundRejectedEnabled:
        serverPreferences.mailboxInboundRejectedEnabled,
      mailboxInboundSlaTargetSuccessPercent:
        serverPreferences.mailboxInboundSlaTargetSuccessPercent,
      mailboxInboundSlaWarningRejectedPercent:
        serverPreferences.mailboxInboundSlaWarningRejectedPercent,
      mailboxInboundSlaCriticalRejectedPercent:
        serverPreferences.mailboxInboundSlaCriticalRejectedPercent,
      mailboxInboundSlaAlertsEnabled:
        serverPreferences.mailboxInboundSlaAlertsEnabled,
      notificationDigestEnabled: serverPreferences.notificationDigestEnabled,
      mailboxInboundSlaAlertCooldownMinutes:
        serverPreferences.mailboxInboundSlaAlertCooldownMinutes,
    });
  }, [data]);

  const normalizeThreshold = (rawValue: number) => {
    if (!Number.isFinite(rawValue)) return 0;
    if (rawValue < 0) return 0;
    if (rawValue > 100) return 100;
    return Math.round(rawValue * 100) / 100;
  };
  const parseThresholdInput = (rawValue: string, fallback: number) => {
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  };
  const normalizeCooldownMinutes = (rawValue: number) => {
    if (!Number.isFinite(rawValue)) return 1;
    if (rawValue < 1) return 1;
    if (rawValue > 24 * 60) return 24 * 60;
    return Math.floor(rawValue);
  };
  const parseCooldownInput = (rawValue: string, fallback: number) => {
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  };

  const handleSave = async () => {
    const normalizedWarningThreshold = Math.min(
      normalizeThreshold(preferences.mailboxInboundSlaWarningRejectedPercent),
      normalizeThreshold(preferences.mailboxInboundSlaCriticalRejectedPercent),
    );
    const normalizedCriticalThreshold = Math.max(
      normalizeThreshold(preferences.mailboxInboundSlaWarningRejectedPercent),
      normalizeThreshold(preferences.mailboxInboundSlaCriticalRejectedPercent),
    );
    await updatePreferences({
      variables: {
        input: {
          inAppEnabled: preferences.inAppEnabled,
          emailEnabled: preferences.emailEnabled,
          pushEnabled: preferences.pushEnabled,
          syncFailureEnabled: preferences.syncFailureEnabled,
          mailboxInboundAcceptedEnabled:
            preferences.mailboxInboundAcceptedEnabled,
          mailboxInboundDeduplicatedEnabled:
            preferences.mailboxInboundDeduplicatedEnabled,
          mailboxInboundRejectedEnabled:
            preferences.mailboxInboundRejectedEnabled,
          mailboxInboundSlaTargetSuccessPercent: normalizeThreshold(
            preferences.mailboxInboundSlaTargetSuccessPercent,
          ),
          mailboxInboundSlaWarningRejectedPercent: normalizedWarningThreshold,
          mailboxInboundSlaCriticalRejectedPercent: normalizedCriticalThreshold,
          mailboxInboundSlaAlertsEnabled:
            preferences.mailboxInboundSlaAlertsEnabled,
          notificationDigestEnabled: preferences.notificationDigestEnabled,
          mailboxInboundSlaAlertCooldownMinutes: normalizeCooldownMinutes(
            preferences.mailboxInboundSlaAlertCooldownMinutes,
          ),
        },
      },
    });
  };

  return (
    <DashboardPageShell
      title="Notification Settings"
      description="Control how MailZen alerts you for sync and inbox events."
      actions={
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
      }
      contentClassName="max-w-3xl space-y-6"
    >
      <div role="alert" className="rounded-lg border border-primary/20 bg-primary/5">
        <h4 className="font-medium mb-1">Backed by live GraphQL preferences</h4>
        <p className="text-sm">These toggles map directly to your persisted notification preferences.</p>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <div className="flex flex-col gap-1.5 p-6 relative z-10">
          <h3 className="leading-none font-semibold">Channels</h3>
          <p className="text-sm text-muted-foreground">
            Choose which channels MailZen can use to reach you.
          </p>
        </div>
        <div className="p-6 space-y-5">
          {error && (
            <InlineError error={new Error(error.message)} />
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">In-app notifications</h3>
              <p className="text-sm text-muted-foreground">
                Show notifications in the dashboard bell and feed.
              </p>
            </div>
            <Switch
              checked={preferences.inAppEnabled}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({ ...prev, inAppEnabled: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">Email notifications</h3>
              <p className="text-sm text-muted-foreground">
                Send email alerts for important account activity.
              </p>
            </div>
            <Switch
              checked={preferences.emailEnabled}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({ ...prev, emailEnabled: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">Push notifications</h3>
              <p className="text-sm text-muted-foreground">
                Receive browser/mobile push alerts when supported.
              </p>
            </div>
            <Switch
              checked={preferences.pushEnabled}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({ ...prev, pushEnabled: checked }))
              }
            />
          </div>
        </div>
        <div className="border-t p-6 pt-4">
          <div className="w-full space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium">Sync failure alerts</h3>
                <p className="text-sm text-muted-foreground">
                  Alert me when provider synchronization fails.
                </p>
              </div>
              <Switch
                checked={preferences.syncFailureEnabled}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({
                    ...prev,
                    syncFailureEnabled: checked,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium">Email digest notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Send periodic digest emails for unread notifications.
                </p>
              </div>
              <Switch
                checked={preferences.notificationDigestEnabled}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({
                    ...prev,
                    notificationDigestEnabled: checked,
                  }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <div className="flex flex-col gap-1.5 p-6 relative z-10">
          <h3 className="leading-none font-semibold">Mailbox inbound status alerts</h3>
          <p className="text-sm text-muted-foreground">
            Decide which inbound processing outcomes should notify you.
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">Accepted inbound events</h3>
              <p className="text-sm text-muted-foreground">
                Notify me when new incoming alias emails are accepted.
              </p>
            </div>
            <Switch
              checked={preferences.mailboxInboundAcceptedEnabled}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  mailboxInboundAcceptedEnabled: checked,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">Deduplicated inbound events</h3>
              <p className="text-sm text-muted-foreground">
                Notify me when replayed message IDs are safely deduplicated.
              </p>
            </div>
            <Switch
              checked={preferences.mailboxInboundDeduplicatedEnabled}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  mailboxInboundDeduplicatedEnabled: checked,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">Rejected inbound events</h3>
              <p className="text-sm text-muted-foreground">
                Notify me when inbound events are rejected due to quota, status, or policy failures.
              </p>
            </div>
            <Switch
              checked={preferences.mailboxInboundRejectedEnabled}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  mailboxInboundRejectedEnabled: checked,
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <div className="flex flex-col gap-1.5 p-6 relative z-10">
          <h3 className="leading-none font-semibold">Mailbox inbound SLA thresholds</h3>
          <p className="text-sm text-muted-foreground">
            Set success and rejection thresholds used by dashboard and header SLA health indicators.
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">SLA alert notifications</h3>
              <p className="text-sm text-muted-foreground">
                Notify me when mailbox inbound SLA enters warning or critical status.
              </p>
            </div>
            <Switch
              checked={preferences.mailboxInboundSlaAlertsEnabled}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  mailboxInboundSlaAlertsEnabled: checked,
                }))
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Target success %</h3>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={preferences.mailboxInboundSlaTargetSuccessPercent}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    mailboxInboundSlaTargetSuccessPercent: parseThresholdInput(
                      event.target.value,
                      prev.mailboxInboundSlaTargetSuccessPercent,
                    ),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum accepted + deduplicated rate expected within window.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Warning rejection %</h3>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={preferences.mailboxInboundSlaWarningRejectedPercent}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    mailboxInboundSlaWarningRejectedPercent: parseThresholdInput(
                      event.target.value,
                      prev.mailboxInboundSlaWarningRejectedPercent,
                    ),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Rejection rate threshold where status flips to WARNING.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Critical rejection %</h3>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={preferences.mailboxInboundSlaCriticalRejectedPercent}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    mailboxInboundSlaCriticalRejectedPercent: parseThresholdInput(
                      event.target.value,
                      prev.mailboxInboundSlaCriticalRejectedPercent,
                    ),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Rejection rate threshold where status flips to CRITICAL.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Alert cooldown (minutes)</h3>
              <Input
                type="number"
                min={1}
                max={24 * 60}
                step={1}
                value={preferences.mailboxInboundSlaAlertCooldownMinutes}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    mailboxInboundSlaAlertCooldownMinutes: parseCooldownInput(
                      event.target.value,
                      prev.mailboxInboundSlaAlertCooldownMinutes,
                    ),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum delay before same-status SLA alerts repeat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardPageShell>
  );
};

export default NotificationsSettingsPage;