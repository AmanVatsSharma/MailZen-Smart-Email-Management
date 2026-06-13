'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmailList } from '@/components/email/EmailList';
import { EmailDetail } from '@/components/email/EmailDetail';
import { EmailComposer } from '@/components/email/EmailComposer';
import { EmailPreviewPane } from '@/components/email/EmailPreviewPane';
import { InboxAiWorkspace } from '@/components/email/InboxAiWorkspace';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmailFolder, EmailThread, EmailLabel } from '@/lib/email/email-types';
import { Button } from '@/components/ui/button';
import { RefreshCw, Filter, MoreVertical, Plus, Keyboard, Sparkles, X, PlugZap, Users, User, Loader2 } from 'lucide-react';
import { gql, useApolloClient, useQuery, useMutation } from '@apollo/client';
import { GET_LABELS, UPDATE_EMAIL, GET_WORKSPACE_EMAILS } from '@/lib/apollo/queries/emails';
import { GET_MY_WORKSPACES } from '@/lib/apollo/queries/workspaces';
import { EmailAssignmentPanel } from '@/components/email/EmailAssignmentPanel';
import { useToast } from '@/components/ui/use-toast';
import { Surface } from '@/components/ui/surface';
import { useSearchParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/tokens/cn';

const GET_PROVIDERS_FOR_INBOX = gql`
  query InboxProviders {
    providers {
      id
      type
      email
      isActive
      status
      lastSynced
    }
  }
`;

const SYNC_PROVIDER_FOR_INBOX = gql`
  mutation InboxSyncProvider($id: String!) {
    syncProvider(id: $id) {
      id
      status
      lastSynced
    }
  }
`;

type InboxProvider = {
  id: string;
  type?: string;
  email?: string;
  isActive?: boolean;
  status?: string;
  lastSynced?: string;
};

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [viewMode, setViewMode] = useState<'preview' | 'full'>('preview');
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [isAiDockOpen, setIsAiDockOpen] = useState(true);
  const [isAiMobileOpen, setIsAiMobileOpen] = useState(false);
  const [aiDraftContent, setAiDraftContent] = useState('');
  const [activeInboxTab, setActiveInboxTab] = useState<'personal' | 'team'>('personal');
  const [rightPanelMode, setRightPanelMode] = useState<'ai' | 'assignment'>('ai');

  const requestedFolder = searchParams.get('folder');
  const currentFolder: EmailFolder =
    requestedFolder === 'inbox' ||
    requestedFolder === 'sent' ||
    requestedFolder === 'archive' ||
    requestedFolder === 'trash' ||
    requestedFolder === 'drafts' ||
    requestedFolder === 'spam'
      ? requestedFolder
      : 'inbox';
  const currentLabel = searchParams.get('label') ?? undefined;
  const currentSearchQuery = searchParams.get('q') ?? '';
  const semanticIdsParam = searchParams.get('semanticIds');
  const semanticEmailIds = semanticIdsParam
    ? semanticIdsParam.split(',').filter(Boolean)
    : undefined;
  
  // Keep track of last selected thread index for keyboard navigation
  const lastSelectedThreadIndex = useRef<number>(-1);
  
  // Get toast functionality
  const { toast } = useToast();
  const apollo = useApolloClient();
  
  // Get update email mutation
  const [updateEmail] = useMutation(UPDATE_EMAIL);
  
  // Fetch labels
  const { data: labelsData } = useQuery(GET_LABELS);
  const availableLabels = labelsData?.labels ?? [];

  // Active workspace for Team inbox tab
  const { data: workspacesData } = useQuery(GET_MY_WORKSPACES, { fetchPolicy: 'cache-first' });
  const teamWorkspace = (workspacesData?.myWorkspaces as Array<{ id: string; name: string; isPersonal: boolean }> | undefined)
    ?.find((w) => !w.isPersonal);
  const activeWorkspaceId = teamWorkspace?.id ?? '';

  // Team inbox emails (workspace-scoped, lazy by tab)
  const { data: teamEmailsData, loading: teamEmailsLoading } = useQuery(GET_WORKSPACE_EMAILS, {
    variables: { workspaceId: activeWorkspaceId, limit: 30 },
    skip: activeInboxTab !== 'team' || !activeWorkspaceId,
    fetchPolicy: 'network-only',
  });
  const teamThreads: EmailThread[] = teamEmailsData?.workspaceEmails?.items ?? [];

  // Provider status (for refresh + UX)
  const { data: providersData } = useQuery(GET_PROVIDERS_FOR_INBOX, { fetchPolicy: 'network-only' });
  const providers = (providersData?.providers as InboxProvider[] | undefined) || [];
  const activeProvider = providers.find((p) => p.isActive) || providers[0];
  const [syncProvider] = useMutation(SYNC_PROVIDER_FOR_INBOX);
  
  // Handle thread selection
  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
    setViewMode('preview'); // Default to preview mode when selecting a thread
  };
  
  // Toggle between preview and full view
  const toggleViewMode = useCallback(() => {
    setViewMode(v => (v === 'preview' ? 'full' : 'preview'));
  }, []);
  
  // Simulate refreshing inbox
  const handleRefreshInbox = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (!activeProvider?.id) {
        toast({
          title: "No provider connected",
          description: "Connect a provider to sync inbox messages.",
          variant: "destructive",
        });
        return;
      }

      await syncProvider({ variables: { id: activeProvider.id } });
      // Refetch inbox queries
      await apollo.refetchQueries({ include: ['GetEmails', 'GetLabels', 'GetFolders'] });

      toast({
        title: "Inbox refreshed",
        description: "Your inbox has been updated with the latest emails",
      });
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Inbox Refresh] failed', e);
      }
      toast({
        title: "Refresh failed",
        description: "Could not sync inbox. Check logs for details.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [activeProvider?.id, apollo, syncProvider, toast]);
  
  // Handle reply to email
  const handleReply = (threadId: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Inbox] reply', { threadId });
    }
    setComposerMode('reply');
    setIsComposerOpen(true);
  };
  
  // Handle forward email
  const handleForward = (threadId: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Inbox] forward', { threadId });
    }
    setComposerMode('forward');
    setIsComposerOpen(true);
  };
  
  // Handle new email
  const handleNewEmail = () => {
    setAiDraftContent('');
    setComposerMode('new');
    setIsComposerOpen(true);
  };

  const handleUseAiDraft = (draft: string) => {
    setAiDraftContent(draft);
    setComposerMode('new');
    setIsComposerOpen(true);
    setIsAiMobileOpen(false);
  };

  const handleComposerClose = () => {
    setIsComposerOpen(false);
    setAiDraftContent('');
  };

  const handleAiWorkspaceToggle = () => {
    if (window.innerWidth >= 1280) {
      setIsAiDockOpen((prev) => !prev);
      return;
    }
    setIsAiMobileOpen(true);
  };
  
  // Handle archiving an email
  const handleArchive = useCallback(async (threadId: string) => {
    try {
      await updateEmail({ variables: { id: threadId, input: { folder: 'archive' } } });
      toast({
        title: "Email archived",
        description: "The email has been moved to the archive",
      });
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
      }
    } catch {
      toast({
        title: "Archive failed",
        description: "Could not archive the email. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedThread?.id, toast, updateEmail]);
  
  // Handle deleting an email
  const handleDelete = useCallback(async (threadId: string) => {
    try {
      await updateEmail({ variables: { id: threadId, input: { folder: 'trash' } } });
      toast({
        title: "Email deleted",
        description: "The email has been moved to trash",
      });
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
      }
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not delete the email. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedThread?.id, toast, updateEmail]);
  
  // Handle toggling star on an email
  const handleToggleStar = useCallback((threadId: string, isStarred: boolean) => {
    // The component now uses GraphQL mutation internally
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Inbox] star toggled', { threadId, isStarred });
    }
    
    // Show notification
    toast({
      title: isStarred ? "Email starred" : "Email unstarred",
      description: isStarred 
        ? "The email has been added to starred" 
        : "The email has been removed from starred",
    });
  }, [toast]);
  
  // Handle batch actions
  const handleBatchAction = async (action: string, threadIds: string[]) => {
    try {
      type UpdateEmailInput = {
        folder?: 'archive' | 'trash' | 'inbox' | 'sent' | 'spam' | 'drafts';
        read?: boolean;
        starred?: boolean;
      };

      // Define the input for each action type
      const inputMap: Record<string, UpdateEmailInput> = {
        archive: { folder: 'archive' },
        delete: { folder: 'trash' },
        markRead: { read: true },
        markUnread: { read: false },
        star: { starred: true },
        unstar: { starred: false }
      };
      
      const input = inputMap[action];
      if (!input) {
        console.error(`Unknown action: ${action}`);
        return;
      }
      
      // Process each thread ID sequentially
      for (const threadId of threadIds) {
        await updateEmail({
          variables: {
            id: threadId,
            input
          }
        });
        
        // If the current selection is among the affected threads, deselect it
        if (selectedThread && threadId === selectedThread.id) {
          // For archive and delete, deselect the thread
          if (action === 'archive' || action === 'delete') {
            setSelectedThread(null);
          }
        }
      }
      
      // Success message
      toast({
        title: "Action completed",
        description: `Successfully applied "${action}" to ${threadIds.length} email(s)`,
      });
    } catch (error) {
      // Show error message
      console.error("Error performing batch action:", error);
      toast({
        title: "Action failed",
        description: `Failed to apply "${action}" to the selected emails`,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    setSelectedThread(null);
    lastSelectedThreadIndex.current = -1;
    setAiDraftContent('');
  }, [currentFolder, currentLabel]);
  
  // Setup keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process keyboard shortcuts if not in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Handle shortcuts
      switch (e.key) {
        case '?':
          // Show keyboard shortcuts dialog
          e.preventDefault();
          setIsShortcutsDialogOpen(true);
          break;
        case 'c':
          // Compose new email
          e.preventDefault();
          handleNewEmail();
          break;
        case 'r':
          // Reply to selected email
          if (selectedThread) {
            e.preventDefault();
            handleReply(selectedThread.id);
          }
          break;
        case 'f':
          // Forward selected email
          if (selectedThread) {
            e.preventDefault();
            handleForward(selectedThread.id);
          }
          break;
        case 'a':
          // Archive selected email
          if (selectedThread && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            handleArchive(selectedThread.id);
          }
          break;
        case 'Delete':
          // Delete selected email
          if (selectedThread) {
            e.preventDefault();
            handleDelete(selectedThread.id);
          }
          break;
        case 's':
          // Star/unstar selected email
          if (selectedThread) {
            e.preventDefault();
            const lastMessage = selectedThread.messages[selectedThread.messages.length - 1];
            handleToggleStar(selectedThread.id, !lastMessage.isStarred);
          }
          break;
        case 'v':
          // Toggle view mode between preview and full
          if (selectedThread) {
            e.preventDefault();
            toggleViewMode();
          }
          break;
        case 'Escape':
          // Clear selection
          if (selectedThread) {
            e.preventDefault();
            setSelectedThread(null);
          }
          break;
        case 'F5':
          // Refresh inbox
          e.preventDefault();
          handleRefreshInbox();
          break;
      }
    };
    
    // Add event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleArchive, handleDelete, handleRefreshInbox, handleToggleStar, selectedThread, toggleViewMode]);
  
  return (
    <div className="h-full">
      <div className="flex h-full gap-4">
        {/* Right side: toolbar + list + preview/detail */}
        <div className="flex-1 flex flex-col h-full overflow-hidden gap-4 min-w-0">
          {/* Toolbar */}
          <Surface
            variant="subtle"
            className="sticky top-0 z-20 px-4 py-3 md:px-5 md:py-4"
            animateIn={false}
          >
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
                {currentLabel
                  ? availableLabels.find((l: EmailLabel) => l.id === currentLabel)?.name
                  : currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1)}
              </h1>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="premium"
                  size="sm"
                  className="gap-1"
                  onClick={handleNewEmail}
                >
                  <Plus className="h-4 w-4" />
                  New Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={handleAiWorkspaceToggle}
                >
                  <Sparkles className="h-4 w-4" />
                  {isAiDockOpen ? 'Hide AI' : 'AI Workspace'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefreshInbox}
                  disabled={isRefreshing}
                  aria-label="Refresh inbox"
                  title="Refresh inbox (F5)"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" size="icon" aria-label="Filters" title="Filters">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsShortcutsDialogOpen(true)}
                  aria-label="Keyboard Shortcuts"
                  title="Keyboard Shortcuts (Press ?)"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" aria-label="More options" title="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Surface>

          {/* Email list + content */}
          <div className="flex flex-1 overflow-hidden gap-4 min-w-0">
            {/* No-provider empty state */}
            {!isRefreshing && providers.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={<PlugZap className="h-7 w-7" />}
                  title="No email provider connected"
                  description="Connect your Gmail or Outlook account to start reading and sending emails from MailZen."
                  action={{
                    label: 'Connect a provider',
                    onClick: () => router.push('/email-providers'),
                  }}
                  className="max-w-md border-dashed"
                />
              </div>
            )}

            {/* Middle panel: list */}
            {(providers.length > 0 || isRefreshing) && (
            <Surface
              className="w-full md:w-[420px] lg:w-[460px] overflow-hidden flex flex-col"
              variant="glass"
              animateIn={false}
            >
              {/* Tab toggle: My Inbox / Team */}
              <div className="flex border-b border-border/40 px-3 shrink-0">
                <button
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                    activeInboxTab === 'personal'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setActiveInboxTab('personal')}
                >
                  <User className="h-3 w-3" />
                  My Inbox
                </button>
                {activeWorkspaceId && (
                  <button
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                      activeInboxTab === 'team'
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setActiveInboxTab('team')}
                  >
                    <Users className="h-3 w-3" />
                    Team
                  </button>
                )}
              </div>

              {/* Personal inbox */}
              {activeInboxTab === 'personal' && (
                <EmailList
                  onSelectThread={handleSelectThread}
                  selectedThreadId={selectedThread?.id}
                  className="flex-1 min-h-0"
                  onBatchAction={handleBatchAction}
                  initialFolder={currentFolder}
                  labelFilter={currentLabel}
                  externalSearchQuery={currentSearchQuery}
                  externalSemanticEmailIds={semanticEmailIds}
                />
              )}

              {/* Team inbox */}
              {activeInboxTab === 'team' && (
                <div className="flex-1 overflow-y-auto min-h-0">
                  {teamEmailsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : teamThreads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <Users className="h-8 w-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium">No team emails yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Share a mailbox with your workspace to see team emails here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {teamThreads.map((thread) => (
                        <button
                          key={thread.id}
                          className={cn(
                            'w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors',
                            selectedThread?.id === thread.id && 'bg-muted/50',
                          )}
                          onClick={() => {
                            handleSelectThread(thread);
                            setRightPanelMode('assignment');
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <p className={cn('flex-1 text-xs font-medium truncate', thread.isUnread && 'font-semibold')}>
                              {thread.subject || '(no subject)'}
                            </p>
                            {thread.aiPriority && (
                              <span className={cn(
                                'shrink-0 text-[10px] font-semibold uppercase',
                                thread.aiPriority === 'HIGH' && 'text-destructive',
                                thread.aiPriority === 'MEDIUM' && 'text-yellow-500',
                                thread.aiPriority === 'LOW' && 'text-green-500',
                              )}>
                                {thread.aiPriority}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {thread.participants[0]?.email ?? ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Surface>
            )}

            {/* Right panel: preview/detail */}
            {(providers.length > 0 || isRefreshing) && (
            <Surface
              className="hidden md:flex flex-1 overflow-hidden"
              variant="glass"
              animateIn={false}
            >
              {selectedThread ? (
                viewMode === 'preview' ? (
                  <EmailPreviewPane
                    thread={selectedThread}
                    availableLabels={availableLabels}
                    onViewFull={toggleViewMode}
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
                    onBackToPreview={toggleViewMode}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
                  <p className="text-sm">Select an email to preview</p>
                </div>
              )}
            </Surface>
            )}

            <Surface
              className={cn(
                'hidden xl:flex w-[340px] min-w-[340px] overflow-hidden flex-col',
                isAiDockOpen ? 'xl:flex' : 'xl:hidden',
              )}
              variant="glass"
              animateIn={false}
            >
              {/* Panel mode toggle (only shown when team tab + thread selected) */}
              {activeInboxTab === 'team' && selectedThread && activeWorkspaceId && (
                <div className="flex border-b border-border/40 px-3 shrink-0">
                  <button
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                      rightPanelMode === 'ai'
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setRightPanelMode('ai')}
                  >
                    <Sparkles className="h-3 w-3" />
                    AI
                  </button>
                  <button
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                      rightPanelMode === 'assignment'
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setRightPanelMode('assignment')}
                  >
                    <Users className="h-3 w-3" />
                    Assign
                  </button>
                </div>
              )}

              {rightPanelMode === 'ai' || activeInboxTab === 'personal' ? (
                <InboxAiWorkspace
                  selectedThread={selectedThread}
                  onUseDraft={handleUseAiDraft}
                  className="flex-1 min-h-0"
                />
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedThread && activeWorkspaceId ? (
                    <EmailAssignmentPanel
                      threadId={selectedThread.id}
                      workspaceId={activeWorkspaceId}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Select a team email to manage its assignment.
                    </p>
                  )}
                </div>
              )}
            </Surface>
          </div>
        </div>
      </div>
      
      {/* Email Composer (Modal) */}
      <EmailComposer 
        isOpen={isComposerOpen}
        onClose={handleComposerClose}
        mode={composerMode}
        replyToThread={composerMode !== 'new' && selectedThread ? selectedThread : undefined}
        threadRecipients={composerMode === 'reply' && selectedThread 
          ? selectedThread.participants 
          : undefined}
        subject={composerMode !== 'new' && selectedThread 
          ? selectedThread.subject 
          : ''}
        initialContent={
          composerMode === 'new'
            ? aiDraftContent
            : composerMode === 'reply' && selectedThread
              ? `\n\n---\nOn ${new Date(selectedThread.lastMessageDate).toLocaleString()}, ${selectedThread.messages[selectedThread.messages.length - 1].from.name} wrote:\n\n${selectedThread.messages[selectedThread.messages.length - 1].contentPreview}...`
              : ''
        }
      />

      <Sheet open={isAiMobileOpen} onOpenChange={setIsAiMobileOpen}>
        <SheetContent side="right" className="w-[92vw] max-w-[420px] p-0 xl:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Inbox AI Workspace</SheetTitle>
            <SheetDescription>Smart reply and insight agents</SheetDescription>
          </SheetHeader>
          <InboxAiWorkspace
            selectedThread={selectedThread}
            onUseDraft={handleUseAiDraft}
            className="h-full"
          />
        </SheetContent>
      </Sheet>
      
      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={isShortcutsDialogOpen} onOpenChange={setIsShortcutsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these keyboard shortcuts to navigate MailZen more efficiently.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6">
            <div>
              <h3 className="text-sm font-medium mb-2 border-b pb-1">Email Composition</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">c</kbd>
                  <span>Compose new email</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">r</kbd>
                  <span>Reply to email</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">f</kbd>
                  <span>Forward email</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2 border-b pb-1">Email Actions</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">a</kbd>
                  <span>Archive email</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">Delete</kbd>
                  <span>Delete email</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">s</kbd>
                  <span>Star/unstar email</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">v</kbd>
                  <span>Toggle view mode</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2 border-b pb-1">Selection & Navigation</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">Shift</kbd>
                  <span>+ Click to select range</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">Shift</kbd>
                  <span>+ A to select all</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd>
                  <span>Clear selection</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">F5</kbd>
                  <span>Refresh inbox</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2 border-b pb-1">Help</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">?</kbd>
                  <span>Show this dialog</span>
                </div>
              </div>
            </div>
          </div>
          
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
