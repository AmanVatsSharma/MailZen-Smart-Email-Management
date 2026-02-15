'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { RefreshCw, Save } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
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
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: false,
  syncFailureEnabled: true,
  mailboxInboundAcceptedEnabled: true,
  mailboxInboundDeduplicatedEnabled: false,
  mailboxInboundRejectedEnabled: true,
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
    });
  }, [data]);

  const handleSave = async () => {
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
      <Alert className="border-primary/20 bg-primary/5">
        <AlertTitle>Backed by live GraphQL preferences</AlertTitle>
        <AlertDescription>
          These toggles map directly to your persisted notification preferences.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
          <CardDescription>
            Choose which channels MailZen can use to reach you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <p className="text-sm text-destructive">
              Failed to load preferences: {error.message}
            </p>
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
        </CardContent>
        <CardFooter className="border-t pt-4">
          <div className="flex w-full items-center justify-between gap-4">
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
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mailbox inbound status alerts</CardTitle>
          <CardDescription>
            Decide which inbound processing outcomes should notify you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
        </CardContent>
      </Card>
    </DashboardPageShell>
  );
};

export default NotificationsSettingsPage;

