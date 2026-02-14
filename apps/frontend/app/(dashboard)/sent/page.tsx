'use client';

import React, { useEffect, useState } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { useSearchParams } from 'next/navigation';
import { Filter, MoreVertical, Plus, RefreshCw } from 'lucide-react';
import { EmailComposer } from '@/components/email/EmailComposer';
import { EmailDetail } from '@/components/email/EmailDetail';
import { EmailList } from '@/components/email/EmailList';
import { EmailPreviewPane } from '@/components/email/EmailPreviewPane';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { useToast } from '@/components/ui/use-toast';
import { GET_LABELS, UPDATE_EMAIL } from '@/lib/apollo/queries/emails';
import { mockLabels } from '@/lib/email/mock-data';
import { type EmailFolder, type EmailLabel, type EmailThread } from '@/lib/email/email-types';

const SentPage = () => {
  const searchParams = useSearchParams();
  const apollo = useApolloClient();
  const { toast } = useToast();

  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'full'>('preview');

  const currentFolder: EmailFolder = 'sent';
  const currentLabel = searchParams.get('label') ?? undefined;

  const { data: labelsData } = useQuery(GET_LABELS);
  const availableLabels = labelsData?.labels || mockLabels;

  const [updateEmail] = useMutation(UPDATE_EMAIL);

  useEffect(() => {
    setSelectedThread(null);
    setViewMode('preview');
  }, [currentLabel]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await apollo.refetchQueries({
        include: ['GetEmails', 'GetLabels', 'GetFolders'],
      });
      toast({
        title: 'Sent folder refreshed',
        description: 'Latest sent activity is now loaded.',
      });
    } catch (error) {
      toast({
        title: 'Refresh failed',
        description: error instanceof Error ? error.message : 'Unable to refresh sent folder.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
    setViewMode('preview');
  };

  const handleReply = (threadId: string) => {
    void threadId;
    setComposerMode('reply');
    setComposerOpen(true);
  };

  const handleForward = (threadId: string) => {
    void threadId;
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
      description: 'The email has been moved to archive.',
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
      title: 'Email moved to trash',
      description: 'The selected email is now in trash.',
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
      description: 'Star state has been updated.',
    });
  };

  type UpdateEmailInput = {
    folder?: EmailFolder;
    read?: boolean;
    starred?: boolean;
  };

  const handleBatchAction = async (action: string, threadIds: string[]) => {
    try {
      const inputMap: Record<string, UpdateEmailInput> = {
        archive: { folder: 'archive' },
        delete: { folder: 'trash' },
        markRead: { read: true },
        markUnread: { read: false },
        star: { starred: true },
        unstar: { starred: false },
      };

      const input = inputMap[action];
      if (!input) return;

      for (const threadId of threadIds) {
        await updateEmail({
          variables: {
            id: threadId,
            input,
          },
        });
      }

      if (selectedThread && threadIds.includes(selectedThread.id)) {
        setSelectedThread(null);
      }

      toast({
        title: 'Action completed',
        description: `Applied "${action}" to ${threadIds.length} email(s).`,
      });
    } catch (error) {
      toast({
        title: 'Action failed',
        description: error instanceof Error ? error.message : 'Unable to apply action.',
        variant: 'destructive',
      });
    }
  };

  const handleComposeEmail = () => {
    setComposerMode('new');
    setComposerOpen(true);
  };

  const title =
    currentLabel
      ? availableLabels.find((label: EmailLabel) => label.id === currentLabel)?.name
      : 'Sent';

  return (
    <div className="h-full">
      <div className="flex h-full gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <Surface
            variant="subtle"
            className="sticky top-0 z-20 px-4 py-3 md:px-5 md:py-4"
            animateIn={false}
          >
            <div className="flex items-center justify-between gap-4">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="premium" size="sm" className="gap-1" onClick={handleComposeEmail}>
                  <Plus className="h-4 w-4" />
                  New Email
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label="Refresh sent emails"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" size="icon" aria-label="Filters">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" aria-label="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Surface>

          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
            <Surface
              className="w-full min-w-0 overflow-hidden flex flex-col md:w-[420px] lg:w-[460px]"
              variant="glass"
              animateIn={false}
            >
              <EmailList
                onSelectThread={handleSelectThread}
                selectedThreadId={selectedThread?.id}
                className="h-full"
                onBatchAction={handleBatchAction}
                initialFolder={currentFolder}
                labelFilter={currentLabel}
              />
            </Surface>

            <Surface
              className="hidden md:flex min-w-0 flex-1 overflow-hidden"
              variant="glass"
              animateIn={false}
            >
              {selectedThread ? (
                viewMode === 'preview' ? (
                  <EmailPreviewPane
                    thread={selectedThread}
                    availableLabels={availableLabels}
                    onViewFull={() => setViewMode('full')}
                    onReply={handleReply}
                    onForward={handleForward}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onToggleStar={handleToggleStar}
                    className="h-full"
                  />
                ) : (
                  <EmailDetail
                    thread={selectedThread}
                    availableLabels={availableLabels}
                    onReply={handleReply}
                    onForward={handleForward}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onToggleStar={handleToggleStar}
                    className="h-full"
                    onBackToPreview={() => setViewMode('preview')}
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center px-8 text-center text-muted-foreground">
                  Select a sent email to view its full thread.
                </div>
              )}
            </Surface>
          </div>
        </div>
      </div>

      <EmailComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        mode={composerMode}
        replyToThread={selectedThread ?? undefined}
        threadRecipients={selectedThread?.participants}
        subject={selectedThread?.subject ?? ''}
      />
    </div>
  );
};

export default SentPage;
