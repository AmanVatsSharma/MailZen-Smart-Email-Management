'use client';

import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Clock, Plus, RefreshCw } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmailComposer } from '@/components/email/EmailComposer';
import { GET_ALL_SCHEDULED_EMAILS } from '@/lib/apollo/queries/scheduled-emails';
import { formatDistanceToNow, format } from 'date-fns';

type ScheduledEmail = {
  id: string;
  subject: string;
  body: string;
  recipientIds: string[];
  scheduledAt: string;
  status: string;
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'SENT') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">
        Sent
      </Badge>
    );
  }
  if (status === 'FAILED') {
    return (
      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20">
      Pending
    </Badge>
  );
}

function ScheduledEmailsTable({ emails }: { emails: ScheduledEmail[] }) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'hsl(262 83% 58% / 0.1)' }}
        >
          <Clock className="h-6 w-6" style={{ color: 'hsl(262 83% 58%)' }} />
        </div>
        <p className="text-sm font-medium text-foreground">No scheduled emails</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the composer to schedule a send — it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="text-xs font-semibold">Subject</TableHead>
            <TableHead className="text-xs font-semibold">Recipients</TableHead>
            <TableHead className="text-xs font-semibold">Scheduled For</TableHead>
            <TableHead className="text-xs font-semibold">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emails.map((email) => {
            const scheduledDate = new Date(email.scheduledAt);
            const isPast = scheduledDate < new Date();
            return (
              <TableRow key={email.id} className="hover:bg-muted/20">
                <TableCell className="font-medium text-sm max-w-[280px] truncate">
                  {email.subject || '(No subject)'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <span className="text-xs">
                    {email.recipientIds.length === 1
                      ? email.recipientIds[0]
                      : `${email.recipientIds[0]} +${email.recipientIds.length - 1} more`}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">
                      {format(scheduledDate, 'MMM d, yyyy h:mm a')}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {isPast
                        ? `${formatDistanceToNow(scheduledDate)} ago`
                        : `in ${formatDistanceToNow(scheduledDate)}`}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={email.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ScheduledEmailsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border/40 p-3">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function ScheduledEmailsPage() {
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const { data, loading, refetch } = useQuery(GET_ALL_SCHEDULED_EMAILS, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 30_000,
  });

  const emails: ScheduledEmail[] = data?.getAllScheduledEmails ?? [];
  const pendingCount = emails.filter((e) => e.status === 'PENDING').length;

  return (
    <DashboardPageShell
      title="Scheduled Emails"
      description={
        pendingCount > 0
          ? `${pendingCount} email${pendingCount !== 1 ? 's' : ''} pending delivery`
          : 'Emails queued for future delivery'
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsComposerOpen(true)}
            className="h-8 gap-1.5 text-xs"
            style={{
              background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 48%))',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Email
          </Button>
        </div>
      }
    >
      {loading && emails.length === 0 ? (
        <ScheduledEmailsSkeleton />
      ) : (
        <ScheduledEmailsTable emails={emails} />
      )}

      {isComposerOpen && (
        <EmailComposer
          isOpen={isComposerOpen}
          onClose={() => setIsComposerOpen(false)}
          mode="new"
        />
      )}
    </DashboardPageShell>
  );
}
