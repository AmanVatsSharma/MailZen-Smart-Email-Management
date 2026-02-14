'use client';

import React, { useState } from 'react';
import { EmailList } from '@/components/email/EmailList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EmailDetail } from '@/components/email/EmailDetail';
import { EmailComposer } from '@/components/email/EmailComposer';
import { useMutation, useQuery } from '@apollo/client';
import { GET_LABELS, UPDATE_EMAIL } from '@/lib/apollo/queries/emails';
import type { EmailLabel, EmailThread } from '@/lib/email/email-types';
import { mockLabels } from '@/lib/email/mock-data';
import { useToast } from '@/components/ui/use-toast';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

const ArchivePage = () => {
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

  const handleBackToArchive = () => {
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
      title: 'Email archived',
      description: 'The email stays in your archive folder.',
    });
  };

  const handleDelete = async (threadId: string) => {
    await updateEmail({
      variables: {
        id: threadId,
        input: { folder: 'trash' },
      },
    });
    toast({
      title: 'Moved to trash',
      description: 'The email has been moved to trash.',
    });
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
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

  return (
    <DashboardPageShell
      title="Archive"
      description="Review archived conversations and restore focus when needed."
      actions={(
        <Button onClick={handleComposeEmail} className="gap-1">
          <Plus className="h-4 w-4" />
          Compose
        </Button>
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
            initialFolder="archive"
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
              onBackToPreview={handleBackToArchive}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-muted-foreground">
              Select an archived thread to inspect details.
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

export default ArchivePage;
