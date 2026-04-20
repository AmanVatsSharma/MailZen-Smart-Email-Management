/**
 * File:        apps/frontend/components/providers/SharedMailboxSettings.tsx
 * Module:      Email Providers · Workspace Sharing
 * Purpose:     Client component that lets users share their MailZen mailbox with a team
 *              workspace so all workspace members can see emails from that mailbox in the
 *              Team inbox tab.
 *
 * Exports:
 *   - SharedMailboxSettings() — standalone card component; renders null if user has no
 *                               non-personal workspace or no MailZen mailboxes
 *
 * Depends on:
 *   - @/lib/apollo/queries/providers — SHARE_MAILBOX_WITH_WORKSPACE, GET_SHARED_MAILBOXES
 *   - @/lib/apollo/queries/workspaces — GET_MY_WORKSPACES
 *   - @/lib/apollo/queries/inboxes   — GET_MY_INBOXES (to list mailboxes)
 *
 * Side-effects:
 *   - Apollo mutation: shareMailboxWithWorkspace (sets isShared=true + workspaceId on mailbox)
 *   - Apollo queries: myWorkspaces, getSharedMailboxes
 *
 * Key invariants:
 *   - Only the first non-personal workspace is used (single-workspace MVP)
 *   - Share is one-way: the mutation sets isShared=true; unsharing is not yet implemented
 *
 * Read order:
 *   1. SharedMailboxSettings — main component
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */
'use client';

import React from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Users, Share2, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { GET_MY_WORKSPACES } from '@/lib/apollo/queries/workspaces';
import { SHARE_MAILBOX_WITH_WORKSPACE, GET_SHARED_MAILBOXES } from '@/lib/apollo/queries/providers';

const GET_MY_INBOXES = gql`
  query SharedMailboxSettingsGetInboxes {
    myInboxes {
      id
      type
      displayName
      mailboxAddress
    }
  }
`;

type Inbox = { id: string; type: string; displayName?: string | null; mailboxAddress?: string | null };
type SharedMailbox = { id: string; address: string; isShared: boolean; workspaceId: string | null };

export function SharedMailboxSettings() {
  const { toast } = useToast();

  const { data: workspacesData } = useQuery(GET_MY_WORKSPACES, { fetchPolicy: 'cache-first' });
  const teamWorkspace = (workspacesData?.myWorkspaces as Array<{ id: string; name: string; isPersonal: boolean }> | undefined)
    ?.find((w) => !w.isPersonal);
  const workspaceId = teamWorkspace?.id;

  const { data: inboxesData } = useQuery(GET_MY_INBOXES, { fetchPolicy: 'network-only' });
  const mailboxInboxes = (inboxesData?.myInboxes as Inbox[] | undefined)
    ?.filter((i) => i.type === 'MAILBOX') ?? [];

  const { data: sharedData, refetch: refetchShared } = useQuery(GET_SHARED_MAILBOXES, {
    variables: { workspaceId },
    skip: !workspaceId,
    fetchPolicy: 'network-only',
  });
  const sharedMailboxes: SharedMailbox[] = sharedData?.getSharedMailboxes ?? [];
  const sharedIds = new Set(sharedMailboxes.map((m) => m.id));

  const [shareMailbox, { loading: sharing }] = useMutation(SHARE_MAILBOX_WITH_WORKSPACE);

  if (!workspaceId || mailboxInboxes.length === 0) return null;

  const handleShare = async (mailboxId: string) => {
    try {
      await shareMailbox({ variables: { mailboxId, workspaceId } });
      toast({ title: 'Mailbox shared', description: `Team members can now see emails from this mailbox.` });
      refetchShared();
    } catch {
      toast({ title: 'Could not share mailbox', variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Team Inbox Sharing</h3>
        <Badge variant="secondary" className="text-[10px] ml-1">Beta</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Share a MailZen mailbox with <span className="font-medium">{teamWorkspace?.name}</span> so all workspace members can see and assign its emails in the Team inbox.
      </p>

      <div className="space-y-2">
        {mailboxInboxes.map((inbox) => {
          const isShared = sharedIds.has(inbox.id);
          return (
            <div
              key={inbox.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {inbox.displayName || inbox.mailboxAddress || inbox.id}
                </p>
                {inbox.mailboxAddress && (
                  <p className="text-[11px] text-muted-foreground truncate">{inbox.mailboxAddress}</p>
                )}
              </div>
              {isShared ? (
                <Badge variant="outline" className="flex items-center gap-1 text-[10px] shrink-0">
                  <CheckCircle className="h-2.5 w-2.5 text-green-500" />
                  Shared
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1.5 shrink-0"
                  onClick={() => handleShare(inbox.id)}
                  disabled={sharing}
                >
                  {sharing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                  Share
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
