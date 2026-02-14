'use client';

import React, { useState } from 'react';
import { EmailList } from '@/components/email/EmailList';
import { EmailDetail } from '@/components/email/EmailDetail';
import { EmailComposer } from '@/components/email/EmailComposer';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { GET_LABELS, UPDATE_EMAIL } from '@/lib/apollo/queries/emails';
import type { EmailThread, EmailLabel } from '@/lib/email/email-types';
import { mockLabels } from '@/lib/email/mock-data';
import { useToast } from '@/components/ui/use-toast';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

const TrashPage = () => {
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'new' | 'reply' | 'forward'>('new');
  const { toast } = useToast();

  // Fetch labels for EmailDetail badge rendering.
  const { data: labelsData } = useQuery(GET_LABELS);
  const availableLabels: EmailLabel[] = labelsData?.labels || mockLabels;
  const [updateEmail] = useMutation(UPDATE_EMAIL);

  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
  };

  const handleBackToTrash = () => {
    setSelectedThread(null);
  };

  const handleComposeEmail = () => {
    setComposerMode('new');
    setComposerOpen(true);
  };

  const handleReply = () => {
    setComposerMode('reply');
    setComposerOpen(true);
  };

  const handleForward = () => {
    setComposerMode('forward');
    setComposerOpen(true);
  };

  const handleArchive = async (threadId: string) => {
    await updateEmail({
      variables: {
        id: threadId,
        input: { folder: 'archive' },
      },
    });
    toast({
      title: 'Moved to archive',
      description: 'The email was restored from trash to archive.',
    });
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
  };

  const handleDelete = async (threadId: string) => {
    await updateEmail({
      variables: {
        id: threadId,
        input: { folder: 'trash' },
      },
    });
    toast({
      title: 'Email remains in trash',
      description: 'Trash status confirmed.',
    });
  };

  const handleToggleStar = async (threadId: string, isStarred: boolean) => {
    await updateEmail({
      variables: {
        id: threadId,
        input: { starred: isStarred },
      },
    });
    toast({
      title: isStarred ? 'Email starred' : 'Email unstarred',
      description: 'Star status updated.',
    });
  };

  const handleEmptyTrash = async () => {
    if (!selectedThread?.id) {
      toast({
        title: 'Select an email first',
        description: 'Open a thread from trash to confirm delete state update.',
      });
      return;
    }
    await updateEmail({
      variables: {
        id: selectedThread.id,
        input: { folder: 'trash' },
      },
    });
    toast({
      title: 'Trash sync complete',
      description: 'Trash state updated through backend resolver.',
    });
  };

  return (
    <DashboardPageShell
      title="Trash"
      description="Review deleted messages and manage trash sync actions."
      actions={(
        <>
          <Button variant="outline" size="sm" onClick={handleEmptyTrash} className="gap-1">
            <Trash2 className="h-4 w-4" />
            Empty Trash
          </Button>
          <Button onClick={handleComposeEmail} className="gap-1">
            <Plus className="h-4 w-4" />
            Compose
          </Button>
        </>
      )}
      contentClassName="flex min-h-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <Surface
          className={cn(
            'min-w-0 overflow-hidden flex-col',
            selectedThread ? 'hidden md:flex md:w-[420px] lg:w-[460px]' : 'flex w-full md:w-[420px] lg:w-[460px]',
          )}
          variant="glass"
          animateIn={false}
        >
          <EmailList
            onSelectThread={handleSelectThread}
            selectedThreadId={selectedThread?.id}
            initialFolder="trash"
            className="h-full"
          />
        </Surface>

        <Surface
          className={cn(
            'min-w-0 flex-1 overflow-hidden',
            selectedThread ? 'flex' : 'hidden md:flex',
          )}
          variant="glass"
          animateIn={false}
        >
          {selectedThread ? (
            <EmailDetail
              thread={selectedThread}
              availableLabels={availableLabels}
              onReply={handleReply}
              onForward={handleForward}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onToggleStar={handleToggleStar}
              onBackToPreview={handleBackToTrash}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-muted-foreground">
              Select a trashed email to preview the full thread.
            </div>
          )}
        </Surface>
      </div>

      <EmailComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        mode={composerMode}
        replyToThread={selectedThread ?? undefined}
        threadRecipients={selectedThread?.participants}
        subject={selectedThread?.subject ?? ''}
      />
    </DashboardPageShell>
  );
};

export default TrashPage;
