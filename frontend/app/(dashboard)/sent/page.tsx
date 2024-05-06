//src/(dashboard)/sent/page.tsx

'use client';

import React, { useState } from 'react';
import { EmailList } from '@/components/email/EmailList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EmailDetail } from '@/components/email/EmailDetail';
import { EmailComposer } from '@/components/email/EmailComposer';
import { EmailNavigation } from '@/components/email/EmailNavigation';
import { EmailFolder, EmailThread, EmailLabel } from '@/lib/email/email-types';
import { mockLabels } from '@/lib/email/mock-data';
import { useQuery, useMutation } from '@apollo/client';
import { GET_LABELS, UPDATE_EMAIL } from '@/lib/apollo/queries/emails';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';

const SentPage = () => {
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('sent');
  const [currentLabel, setCurrentLabel] = useState<string | undefined>(undefined);

  // Fetch labels
  const { data: labelsData } = useQuery(GET_LABELS);
  const availableLabels = labelsData?.labels || mockLabels;
  
  // Get toast
  const { toast } = useToast();
  
  // Get mutation
  const [updateEmail] = useMutation(UPDATE_EMAIL);

  // Handle folder selection
  const handleFolderSelect = (folder: EmailFolder) => {
    setCurrentFolder(folder);
    setCurrentLabel(undefined); // Clear label selection when folder changes
    setSelectedThread(null); // Clear selected thread
  };
  
  // Handle label selection
  const handleLabelSelect = (labelId: string) => {
    setCurrentLabel(labelId);
    setCurrentFolder('sent'); // Default to sent view when showing labeled emails
    setSelectedThread(null); // Clear selected thread
  };

  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
  };

  const handleReply = (threadId: string) => {
    // Implement reply functionality
    console.log(`Reply to: ${threadId}`);
  };

  const handleForward = (threadId: string) => {
    // Implement forward functionality
    console.log(`Forward: ${threadId}`);
  };

  const handleArchive = (threadId: string) => {
    // Would use a GraphQL mutation in a real app
    console.log(`Archive: ${threadId}`);
    
    // Show notification
    toast({
      title: "Email archived",
      description: "The email has been moved to the archive",
    });
  };

  const handleDelete = (threadId: string) => {
    // Would use a GraphQL mutation in a real app
    console.log(`Delete: ${threadId}`);
    
    // Show notification
    toast({
      title: "Email deleted",
      description: "The email has been moved to trash",
    });
    
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
  };

  const handleToggleStar = (threadId: string, isStarred: boolean) => {
    // The component now uses GraphQL mutation internally
    console.log(`Star toggled: ${threadId} - ${isStarred}`);
    
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

  const handleComposeEmail = () => {
    setComposerOpen(true);
  };

  return (
    <div className="h-full">
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
          <div className="py-4 px-6 flex items-center justify-between bg-background">
            <h1 className="text-2xl font-bold">
              {currentLabel 
                ? availableLabels.find((l: EmailLabel) => l.id === currentLabel)?.name 
                : currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1)}
            </h1>
            <Button onClick={handleComposeEmail} className="gap-1">
              <Plus className="h-4 w-4" />
              Compose
            </Button>
          </div>

          <Separator />

          <div className="flex-1 overflow-hidden pt-4">
            <div className="flex h-full">
              <div className="w-1/3 pr-4">
                <EmailList 
                  onSelectThread={handleSelectThread}
                  selectedThreadId={selectedThread?.id}
                  className="h-full"
                  onBatchAction={handleBatchAction}
                  initialFolder={currentFolder}
                  labelFilter={currentLabel}
                />
              </div>
              
              <div className="flex-1">
                <EmailDetail 
                  thread={selectedThread}
                  availableLabels={availableLabels}
                  onReply={handleReply}
                  onForward={handleForward}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onToggleStar={handleToggleStar}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <EmailComposer 
        isOpen={composerOpen} 
        onClose={() => setComposerOpen(false)}
        mode="new"
      />
    </div>
  );
};

export default SentPage;
