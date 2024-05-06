'use client';

import React, { useState, useEffect, useRef } from 'react';
import { EmailList } from '@/components/email/EmailList';
import { EmailDetail } from '@/components/email/EmailDetail';
import { EmailComposer } from '@/components/email/EmailComposer';
import { EmailNavigation } from '@/components/email/EmailNavigation';
import { EmailPreviewPane } from '@/components/email/EmailPreviewPane';
import { EmailFolder, EmailThread, EmailLabel } from '@/lib/email/email-types';
import { mockLabels } from '@/lib/email/mock-data';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { RefreshCw, Filter, MoreVertical, Plus, Keyboard, X } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_LABELS, UPDATE_EMAIL } from '@/lib/apollo/queries/emails';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';

export default function InboxPage() {
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('inbox');
  const [currentLabel, setCurrentLabel] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'preview' | 'full'>('preview');
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  
  // Keep track of last selected thread index for keyboard navigation
  const lastSelectedThreadIndex = useRef<number>(-1);
  
  // Get toast functionality
  const { toast } = useToast();
  
  // Get update email mutation
  const [updateEmail] = useMutation(UPDATE_EMAIL);
  
  // Fetch labels
  const { data: labelsData } = useQuery(GET_LABELS);
  const availableLabels = labelsData?.labels || mockLabels;
  
  // Handle folder selection
  const handleFolderSelect = (folder: EmailFolder) => {
    setCurrentFolder(folder);
    setCurrentLabel(undefined); // Clear label selection when folder changes
    setSelectedThread(null); // Clear selected thread
    lastSelectedThreadIndex.current = -1; // Reset last selected index
  };
  
  // Handle label selection
  const handleLabelSelect = (labelId: string) => {
    setCurrentLabel(labelId);
    setCurrentFolder('inbox'); // Default to inbox view when showing labeled emails
    setSelectedThread(null); // Clear selected thread
    lastSelectedThreadIndex.current = -1; // Reset last selected index
  };
  
  // Handle thread selection
  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
    setViewMode('preview'); // Default to preview mode when selecting a thread
  };
  
  // Toggle between preview and full view
  const toggleViewMode = () => {
    setViewMode(viewMode === 'preview' ? 'full' : 'preview');
  };
  
  // Simulate refreshing inbox
  const handleRefreshInbox = () => {
    setIsRefreshing(true);
    
    // In a real app, this would refetch the emails query
    setTimeout(() => {
      setIsRefreshing(false);
      
      // Show refresh notification
      toast({
        title: "Inbox refreshed",
        description: "Your inbox has been updated with the latest emails",
      });
    }, 1500);
  };
  
  // Handle reply to email
  const handleReply = (threadId: string) => {
    setComposerMode('reply');
    setIsComposerOpen(true);
  };
  
  // Handle forward email
  const handleForward = (threadId: string) => {
    setComposerMode('forward');
    setIsComposerOpen(true);
  };
  
  // Handle new email
  const handleNewEmail = () => {
    setComposerMode('new');
    setIsComposerOpen(true);
  };
  
  // Handle archiving an email
  const handleArchive = (threadId: string) => {
    // Would use a GraphQL mutation in a real app
    console.log(`Archive thread: ${threadId}`);
    
    // Show notification
    toast({
      title: "Email archived",
      description: "The email has been moved to the archive",
    });
    
    // If the archived thread is the currently selected one, deselect it
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
  };
  
  // Handle deleting an email
  const handleDelete = (threadId: string) => {
    // Would use a GraphQL mutation in a real app
    console.log(`Delete thread: ${threadId}`);
    
    // Show notification
    toast({
      title: "Email deleted",
      description: "The email has been moved to trash",
    });
    
    // If the deleted thread is the currently selected one, deselect it
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
  };
  
  // Handle toggling star on an email
  const handleToggleStar = (threadId: string, isStarred: boolean) => {
    // The component now uses GraphQL mutation internally
    console.log(`Star toggled for thread ${threadId}: ${isStarred}`);
    
    // Show notification
    toast({
      title: isStarred ? "Email starred" : "Email unstarred",
      description: isStarred 
        ? "The email has been added to starred" 
        : "The email has been removed from starred",
    });
  };
  
  // Handle batch actions
  const handleBatchAction = async (action: string, threadIds: string[]) => {
    try {
      // Define the input for each action type
      const inputMap: Record<string, any> = {
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
  }, [selectedThread]);
  
  return (
    <div className="container p-0 h-full">
      <div className="flex h-full">
        {/* Email Navigation Sidebar */}
        <EmailNavigation 
          currentFolder={currentFolder}
          onFolderSelect={handleFolderSelect}
          currentLabel={currentLabel}
          onLabelSelect={handleLabelSelect}
        />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Toolbar */}
          <div className="py-4 px-6 flex items-center justify-between bg-background sticky top-0 z-10">
            <h1 className="text-2xl font-bold">
              {currentLabel 
                ? availableLabels.find((l: EmailLabel) => l.id === currentLabel)?.name 
                : currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1)}
            </h1>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="default"
                size="sm"
                className="gap-1"
                onClick={handleNewEmail}
              >
                <Plus className="h-4 w-4" />
                New Email
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleRefreshInbox}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="icon">
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
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Separator />
          
          {/* Email List and Content Area */}
          <div className="flex flex-1 overflow-hidden">
            <div className="w-full md:w-2/5 lg:w-1/3 overflow-hidden pr-4">
              <EmailList 
                onSelectThread={handleSelectThread}
                selectedThreadId={selectedThread?.id}
                className="h-full"
                onBatchAction={handleBatchAction}
                initialFolder={currentFolder}
                labelFilter={currentLabel}
              />
            </div>
            
            <Separator orientation="vertical" className="mr-4 hidden md:block" />
            
            {/* Email Content Panel - Conditionally show preview or full view */}
            <div className="hidden md:block md:flex-1 overflow-auto">
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
                  <p>Select an email to view</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Email Composer (Modal) */}
      <EmailComposer 
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        mode={composerMode}
        replyToThread={composerMode !== 'new' && selectedThread ? selectedThread : undefined}
        threadRecipients={composerMode === 'reply' && selectedThread 
          ? selectedThread.participants 
          : undefined}
        subject={composerMode !== 'new' && selectedThread 
          ? selectedThread.subject 
          : ''}
        initialContent={composerMode === 'reply' && selectedThread 
          ? `\n\n---\nOn ${new Date(selectedThread.lastMessageDate).toLocaleString()}, ${selectedThread.messages[selectedThread.messages.length - 1].from.name} wrote:\n\n${selectedThread.messages[selectedThread.messages.length - 1].contentPreview}...`
          : ''}
      />
      
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
