/**
 * File:        apps/frontend/app/(dashboard)/settings/privacy/page.tsx
 * Module:      Settings · Privacy & Data
 * Purpose:     GDPR-compliant data export page — lets users download a full JSON
 *              snapshot of their account data via the myAccountDataExport query.
 *
 * Exports:
 *   - PrivacyPage (default) — settings page component
 *
 * Depends on:
 *   - MY_ACCOUNT_DATA_EXPORT — from privacy.ts (lazy query, only fires on user action)
 *   - DashboardPageShell     — standard page header/content wrapper
 *
 * Side-effects:
 *   - GraphQL query: myAccountDataExport (lazy — only fires when user clicks Export)
 *   - DOM: triggers a browser file download via an <a> blob URL
 *
 * Key invariants:
 *   - dataJson is already a JSON string; no re-serialization needed for the download blob
 *   - The query is intentionally not auto-fetched — data export is user-initiated
 *
 * Read order:
 *   1. PrivacyPage — full implementation
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

'use client';

import React, { useState } from 'react';
import { useLazyQuery } from '@apollo/client';
import { Download, Lock, Shield, FileJson, AlertCircle } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { MY_ACCOUNT_DATA_EXPORT } from '@/lib/apollo/queries/privacy';
import { format, parseISO } from 'date-fns';

const DATA_CATEGORIES = [
  { label: 'Account profile', description: 'Name, email, role, verification status' },
  { label: 'Email providers', description: 'Connected accounts and OAuth tokens' },
  { label: 'Mailboxes', description: 'Provisioned mailbox addresses and sync state' },
  { label: 'Workspaces', description: 'Workspace memberships and roles' },
  { label: 'Subscriptions', description: 'Billing plan, trial state, credit balance' },
];

export default function PrivacyPage() {
  const { toast } = useToast();
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);

  const [runExport, { loading }] = useLazyQuery<{
    myAccountDataExport: { generatedAtIso: string; dataJson: string };
  }>(MY_ACCOUNT_DATA_EXPORT, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      const { generatedAtIso, dataJson } = data.myAccountDataExport;
      const blob = new Blob([dataJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mailzen-data-export-${generatedAtIso.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastExportedAt(generatedAtIso);
      toast({
        title: 'Export downloaded',
        description: 'Your account data has been downloaded as a JSON file.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Export failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <DashboardPageShell
      title="Privacy & Data"
      description="Manage your personal data and privacy settings."
    >
      <div className="space-y-6 max-w-2xl">
        {/* Data Export Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <FileJson className="h-5 w-5 text-primary" />
              </span>
              <div>
                <CardTitle className="text-base">Download Your Data</CardTitle>
                <CardDescription>
                  Export a complete JSON snapshot of all data associated with your account.
                  This is your right under GDPR Article 20 (data portability).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                What&apos;s included
              </p>
              <ul className="space-y-2">
                {DATA_CATEGORIES.map((cat) => (
                  <li key={cat.label} className="flex items-start gap-2 text-sm">
                    <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
                    <span>
                      <span className="font-medium">{cat.label}</span>
                      <span className="text-muted-foreground"> — {cat.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {lastExportedAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Download className="h-3 w-3" />
                Last exported:{' '}
                <Badge variant="outline" className="text-xs font-normal">
                  {format(parseISO(lastExportedAt), 'dd MMM yyyy, HH:mm')}
                </Badge>
              </div>
            )}

            <Button
              onClick={() => runExport()}
              disabled={loading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {loading ? 'Preparing export…' : 'Export My Data'}
            </Button>
          </CardContent>
        </Card>

        {/* Privacy info card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </span>
              <div>
                <CardTitle className="text-base">Data Retention</CardTitle>
                <CardDescription>
                  How long MailZen keeps your data and what you can request.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Account deletion</AlertTitle>
              <AlertDescription>
                To permanently delete your account and all associated data, contact support.
                Deletion is irreversible and removes all emails, contacts, billing history,
                and AI-generated content within 30 days.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </DashboardPageShell>
  );
}
