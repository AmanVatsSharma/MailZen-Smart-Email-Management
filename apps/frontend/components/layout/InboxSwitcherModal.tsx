'use client';

import React, { useState } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { Check, ChevronDown, Mailbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { GET_MY_INBOXES, SET_ACTIVE_INBOX } from '@/lib/apollo/queries/inboxes';
import { cn } from '@/lib/utils';

type InboxType = 'MAILBOX' | 'PROVIDER';

type UserInbox = {
  id: string;
  type: InboxType;
  address: string;
  isActive: boolean;
  status?: string | null;
};

type MyInboxesData = {
  myInboxes: UserInbox[];
};

type SetActiveInboxResult = {
  setActiveInbox: UserInbox[];
};

type SetActiveInboxVariables = {
  input: {
    type: InboxType;
    id: string;
  };
};

const statusLabel = (status?: string | null) => {
  if (!status) return 'connected';
  return String(status).replaceAll('_', ' ').toLowerCase();
};

export function InboxSwitcherModal() {
  const client = useApolloClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const {
    data,
    loading,
    refetch: refetchInboxes,
  } = useQuery<MyInboxesData>(GET_MY_INBOXES, {
    fetchPolicy: 'network-only',
  });

  const [setActiveInbox, { loading: switching }] = useMutation<
    SetActiveInboxResult,
    SetActiveInboxVariables
  >(SET_ACTIVE_INBOX, {
    onError: (error) => {
      toast({
        title: 'Switch failed',
        description: error.message || 'Unable to switch inbox',
        variant: 'destructive',
      });
    },
  });

  const inboxes = data?.myInboxes ?? [];
  const activeInbox = inboxes.find((item) => item.isActive) ?? null;

  const mailboxCount = inboxes.filter((item) => item.type === 'MAILBOX').length;
  const providerCount = inboxes.filter((item) => item.type === 'PROVIDER').length;

  const handleSwitch = async (target: UserInbox) => {
    if (target.isActive || switching) return;

    await setActiveInbox({
      variables: {
        input: {
          type: target.type,
          id: target.id,
        },
      },
    });

    await Promise.all([
      refetchInboxes(),
      client.refetchQueries({
        include: [
          'MyInboxes',
          'GetEmails',
          'GetFolders',
          'GetLabels',
          'Providers',
          'InboxProviders',
        ],
      }),
    ]);

    toast({
      title: 'Inbox switched',
      description: `Now viewing ${target.address}`,
    });
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="hidden md:flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        <Mailbox className="h-4 w-4" />
        <span className="max-w-[180px] truncate">
          {activeInbox?.address ?? 'Switch mailbox'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Switch mailbox"
      >
        <Mailbox className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mailbox className="h-5 w-5" />
              Switch inbox source
            </DialogTitle>
            <DialogDescription>
              View and switch between your MailZen aliases and connected providers.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Badge variant="outline">{mailboxCount} mailbox</Badge>
            <Badge variant="outline">{providerCount} provider</Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto gap-1"
              onClick={() => {
                void refetchInboxes();
              }}
              disabled={loading || switching}
            >
              <RefreshCw
                className={cn(
                  'h-3.5 w-3.5',
                  (loading || switching) && 'animate-spin',
                )}
              />
              Refresh
            </Button>
          </div>

          <ScrollArea className="h-[340px] rounded-md border border-border/70">
            <div className="divide-y">
              {inboxes.map((inbox) => {
                const isActive = inbox.isActive;
                return (
                  <button
                    key={`${inbox.type}-${inbox.id}`}
                    type="button"
                    onClick={() => {
                      void handleSwitch(inbox);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10'
                        : 'hover:bg-accent/60',
                    )}
                    disabled={switching}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border',
                        isActive
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {isActive ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Mailbox className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{inbox.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {inbox.type === 'MAILBOX' ? 'MailZen alias' : 'External provider'}
                      </p>
                    </div>
                    <Badge variant={isActive ? 'default' : 'secondary'}>
                      {isActive ? 'active' : statusLabel(inbox.status)}
                    </Badge>
                  </button>
                );
              })}

              {!inboxes.length && !loading ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No inbox sources available yet.
                </div>
              ) : null}

              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading inbox sources...
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
