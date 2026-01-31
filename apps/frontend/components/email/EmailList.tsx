'use client';

import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Star,
  StarOff,
  Paperclip,
  Clock,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Archive,
  Mail,
  Tag,
  Inbox,
  Send,
  AlertCircle,
  FilePen,
  ArrowUpDown,
  Calendar,
  User,
  MoveDown,
  MoveUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmailThread, EmailLabel, EmailFolder, EmailFilter, EmailSortOption } from '@/lib/email/email-types';
import { mockLabels } from '@/lib/email/mock-data';
import { EmailThreadItem } from './EmailThreadItem';
import { EmailSearch } from './EmailSearch';
import { EmailListSkeleton } from './EmailListSkeleton';
import { EmailPagination } from './EmailPagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation } from '@apollo/client';
import { GET_EMAILS, GET_LABELS, UPDATE_EMAIL } from '@/lib/apollo/queries/emails';
import { useToast } from '@/components/ui/use-toast';

// Mock email data for demonstration
const mockEmails = [
  {
    id: '1',
    from: { name: 'GitHub', email: 'noreply@github.com' },
    subject: 'Action required: Your GitHub access will expire in 24 hours',
    excerpt:
      'Your GitHub password will expire in 24 hours. To create a new password, click the link below...',
    time: '10:42 AM',
    isUnread: true,
    isStarred: false,
    hasAttachment: false,
    isScheduled: false,
    labels: ['important'],
  },
  {
    id: '2',
    from: { name: 'Slack', email: 'notifications@slack.com' },
    subject: 'New message from Jane in #general',
    excerpt:
      'Jane: Hey team, I just pushed the new UI updates to the staging environment. Please take a look...',
    time: 'Yesterday',
    isUnread: false,
    isStarred: true,
    hasAttachment: true,
    isScheduled: false,
    labels: ['work'],
  },
  {
    id: '3',
    from: { name: 'Netflix', email: 'info@netflix.com' },
    subject: 'Your monthly Netflix subscription',
    excerpt:
      'Your monthly subscription has been processed successfully. Here are the details of your payment...',
    time: 'Feb 28',
    isUnread: false,
    isStarred: false,
    hasAttachment: false,
    isScheduled: false,
    labels: ['finance'],
  },
  {
    id: '4',
    from: { name: 'Amazon', email: 'orders@amazon.com' },
    subject: 'Your Amazon.com order has shipped',
    excerpt:
      'Your order #302-5938604-2130727 has been shipped and is on its way. You can track your package...',
    time: 'Feb 27',
    isUnread: true,
    isStarred: false,
    hasAttachment: true,
    isScheduled: false,
    labels: [],
  },
  {
    id: '5',
    from: { name: 'LinkedIn', email: 'notifications@linkedin.com' },
    subject: 'New connection request from John Smith',
    excerpt:
      'John Smith wants to connect with you on LinkedIn. Accept the request to expand your network...',
    time: 'Feb 25',
    isUnread: false,
    isStarred: false,
    hasAttachment: false,
    isScheduled: true,
    labels: ['personal'],
  },
];

// Label color map
const labelColors: Record<string, string> = {
  important: 'bg-red-500',
  work: 'bg-blue-500',
  personal: 'bg-green-500',
  finance: 'bg-purple-500',
};

interface EmailListProps {
  onSelectThread: (thread: EmailThread) => void;
  selectedThreadId?: string;
  className?: string;
  onBatchAction?: (action: string, threadIds: string[]) => void;
  initialFolder?: EmailFolder;
  labelFilter?: string;
}

// Number of emails per page
const PAGE_SIZE = 10;

export function EmailList({
  onSelectThread,
  selectedThreadId,
  className = '',
  onBatchAction,
  initialFolder = 'inbox',
  labelFilter,
}: EmailListProps) {
  // State for folder, search, and pagination
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>(initialFolder);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Add state for selected emails
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // Add state for sorting
  const [sortOption, setSortOption] = useState<EmailSortOption>({
    field: 'date',
    direction: 'desc'
  });
  
  // Get toast
  const { toast } = useToast();
  
  // Reset to page 1 when search, folder, or label changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, currentFolder, labelFilter]);
  
  // Effect to update current folder when initialFolder prop changes
  useEffect(() => {
    setCurrentFolder(initialFolder);
  }, [initialFolder]);
  
  // Prepare GraphQL variables
  const filter: EmailFilter = {
    folder: currentFolder,
    search: searchQuery,
    labelIds: labelFilter ? [labelFilter] : undefined
  };
  
  // Fetch emails with Apollo Client
  const { loading: isLoading, data } = useQuery(GET_EMAILS, {
    variables: {
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      filter: filter,
      sort: sortOption
    },
    fetchPolicy: 'network-only'
  });
  
  // Fetch labels
  const { data: labelsData } = useQuery(GET_LABELS);
  
  // Update email mutation
  const [updateEmail] = useMutation(UPDATE_EMAIL);
  
  // Setup emails state from GraphQL data
  const emails = {
    items: data?.emails || [],
    total: data?.emails?.length || 0,
    page: currentPage,
    pageSize: PAGE_SIZE,
    hasMore: (data?.emails?.length || 0) === PAGE_SIZE,
  };
  
  // Handle thread selection
  const handleSelectThread = (thread: EmailThread) => {
    onSelectThread(thread);
  };

  // Handle starring/unstarring an email
  const handleToggleStar = (threadId: string, isStarred: boolean) => {
    // Call the GraphQL mutation to update the email
    updateEmail({
      variables: {
        id: threadId,
        input: {
          starred: isStarred
        }
      }
    }).catch(error => {
      console.error('Error updating email star status:', error);
    });
  };

  // Calculate total pages
  const totalPages = Math.ceil(emails.total / PAGE_SIZE);

  // Get folder icon
  const getFolderIcon = (folder: EmailFolder) => {
    switch (folder) {
      case 'inbox':
        return <Inbox className="h-4 w-4" />;
      case 'sent':
        return <Send className="h-4 w-4" />;
      case 'drafts':
        return <FilePen className="h-4 w-4" />;
      case 'trash':
        return <AlertCircle className="h-4 w-4" />;
      case 'spam':
        return <AlertCircle className="h-4 w-4" />;
      case 'archive':
        return <Archive className="h-4 w-4" />;
      default:
        return <Inbox className="h-4 w-4" />;
    }
  };

  // Handle selecting a thread for batch action
  const handleSelectThreadForBatch = (threadId: string) => {
    setSelectedThreadIds(prev => {
      // If already selected, remove it
      if (prev.includes(threadId)) {
        return prev.filter(id => id !== threadId);
      }
      // Otherwise, add it
      return [...prev, threadId];
    });
  };
  
  // Toggle select mode
  const toggleSelectMode = () => {
    if (isSelectMode) {
      // Clear selections when exiting select mode
      setSelectedThreadIds([]);
    }
    setIsSelectMode(!isSelectMode);
  };
  
  // Select all visible threads
  const handleSelectAll = () => {
    if (emails.items.length === selectedThreadIds.length) {
      // If all are selected, deselect all
      setSelectedThreadIds([]);
    } else {
      // Otherwise, select all
      setSelectedThreadIds(emails.items.map((thread: EmailThread) => thread.id));
    }
  };
  
  // Select range of emails (Shift+click functionality)
  const handleRangeSelect = (threadId: string, index: number) => {
    if (selectedThreadIds.length === 0) {
      // If nothing is selected, just select this one
      setSelectedThreadIds([threadId]);
      return;
    }
    
    // Find the last selected email index
    const lastSelectedIndex = emails.items.findIndex(
      (item: EmailThread) => item.id === selectedThreadIds[selectedThreadIds.length - 1]
    );
    
    if (lastSelectedIndex === -1) return;
    
    // Get the range of emails between last selected and current
    const startIdx = Math.min(lastSelectedIndex, index);
    const endIdx = Math.max(lastSelectedIndex, index);
    
    // Get all thread IDs in the range
    const rangeIds = emails.items
      .slice(startIdx, endIdx + 1)
      .map((thread: EmailThread) => thread.id);
    
    // Add the range to existing selection, ensuring no duplicates
    const newSelectedIds = [...new Set([...selectedThreadIds, ...rangeIds])];
    setSelectedThreadIds(newSelectedIds);
  };
  
  // Handle batch actions
  const handleBatchAction = (action: string) => {
    if (selectedThreadIds.length === 0) {
      toast({
        title: "No emails selected",
        description: "Please select at least one email to perform this action",
        variant: "destructive"
      });
      return;
    }
    
    // Perform action via callback
    if (onBatchAction) {
      onBatchAction(action, selectedThreadIds);
    }
    
    // Show toast based on action
    const actionMap: Record<string, string> = {
      archive: "archived",
      delete: "deleted",
      markRead: "marked as read",
      markUnread: "marked as unread",
      star: "starred",
      unstar: "unstarred"
    };
    
    toast({
      title: `${selectedThreadIds.length} emails ${actionMap[action] || action}`,
      description: `The selected emails have been ${actionMap[action] || action}`
    });
    
    // Clear selections after action
    setSelectedThreadIds([]);
  };

  // Add a handler for sorting
  const handleSort = (field: 'date' | 'from' | 'subject' | 'importance') => {
    setSortOption(current => {
      // Toggle direction if same field, otherwise set to desc
      const direction = current.field === field 
        ? (current.direction === 'asc' ? 'desc' : 'asc') 
        : 'desc';
        
      return { field, direction };
    });
    
    // Reset to first page
    setCurrentPage(1);
    
    // Show sorting toast
    toast({
      title: "Emails sorted",
      description: `Sorting by ${field} in ${sortOption.field === field && sortOption.direction === 'asc' ? 'descending' : 'ascending'} order`,
      duration: 2000,
    });
  };
  
  // Get sort icon based on current sort
  const getSortIcon = (field: 'date' | 'from' | 'subject' | 'importance') => {
    if (sortOption.field !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    
    return sortOption.direction === 'asc' 
      ? <MoveUp className="h-3 w-3 ml-1" />
      : <MoveDown className="h-3 w-3 ml-1" />;
  };

  // Add keyboard shortcut handler for the email list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if not in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      
      // Handle key combinations
      if (e.key === 'a' && e.shiftKey) {
        // Shift+A to select all
        e.preventDefault();
        handleSelectAll();
        if (!isSelectMode) setIsSelectMode(true);
      } else if (e.key === 'Escape' && isSelectMode) {
        // Escape to exit select mode
        e.preventDefault();
        toggleSelectMode();
      } else if (e.key === 'Delete' && selectedThreadIds.length > 0) {
        // Delete selected emails
        e.preventDefault();
        handleBatchAction('delete');
      } else if (e.key === 'a' && e.ctrlKey) {
        // Prevent browser's select all
        if (isSelectMode) {
          e.preventDefault();
          handleSelectAll();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectMode, selectedThreadIds, emails.items]);

  return (
    <div className={cn('flex flex-col h-full p-4', className)}>
      {/* Top toolbar */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <Checkbox 
                checked={selectedThreadIds.length > 0 && selectedThreadIds.length === emails.items.length} 
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
                className={selectedThreadIds.length > 0 && selectedThreadIds.length < emails.items.length ? "data-[state=indeterminate]:bg-primary" : ""}
              />
              <span className="text-sm font-medium ml-1">
                {selectedThreadIds.length} selected
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleBatchAction('archive')}
                disabled={selectedThreadIds.length === 0}
                className="ml-2"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleBatchAction('delete')}
                disabled={selectedThreadIds.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={selectedThreadIds.length === 0}>
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBatchAction('markRead')}>
                    <Mail className="h-4 w-4 mr-2" />
                    Mark as read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBatchAction('markUnread')}>
                    <Mail className="h-4 w-4 mr-2" />
                    Mark as unread
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBatchAction('star')}>
                    <Star className="h-4 w-4 mr-2" />
                    Star
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBatchAction('unstar')}>
                    <StarOff className="h-4 w-4 mr-2" />
                    Unstar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Select 
                value={currentFolder} 
                onValueChange={(value) => setCurrentFolder(value as EmailFolder)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbox">
                    <div className="flex items-center gap-2">
                      <Inbox className="h-4 w-4" />
                      <span>Inbox</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sent">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      <span>Sent</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="drafts">
                    <div className="flex items-center gap-2">
                      <FilePen className="h-4 w-4" />
                      <span>Drafts</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="trash">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>Trash</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="spam">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>Spam</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="archive">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4" />
                      <span>Archive</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="sm"
                className="flex items-center gap-1 text-sm font-normal"
                onClick={toggleSelectMode}
              >
                Select
              </Button>
              
              {/* Add sort dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm font-normal">
                    Sort
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem 
                    onClick={() => handleSort('date')}
                    className="flex justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Date</span>
                    </div>
                    {getSortIcon('date')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleSort('from')}
                    className="flex justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Sender</span>
                    </div>
                    {getSortIcon('from')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleSort('subject')}
                    className="flex justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Subject</span>
                    </div>
                    {getSortIcon('subject')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <EmailSearch
            onSearch={setSearchQuery}
            className="w-64"
            placeholder={`Search in ${currentFolder}...`}
            initialQuery={searchQuery}
          />
          {isSelectMode && (
            <Button variant="ghost" size="sm" onClick={toggleSelectMode}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      
      {/* Email list header with sort indicators - visible only when not in select mode */}
      {!isLoading && emails.items.length > 0 && !isSelectMode && (
        <div className="flex items-center py-2 px-3 text-xs text-muted-foreground border-b bg-muted/30">
          <div 
            className="flex items-center w-1/3 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleSort('from')}
          >
            <span>From</span>
            {getSortIcon('from')}
          </div>
          <div 
            className="flex items-center flex-1 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleSort('subject')}
          >
            <span>Subject</span>
            {getSortIcon('subject')}
          </div>
          <div 
            className="flex items-center w-20 justify-end cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleSort('date')}
          >
            <span>Date</span>
            {getSortIcon('date')}
          </div>
        </div>
      )}
      
      {/* Email list */}
      <div className="flex-1 overflow-auto py-4 space-y-2">
        {isLoading ? (
          <EmailListSkeleton count={PAGE_SIZE} />
        ) : emails.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              {getFolderIcon(currentFolder)}
            </div>
            <h3 className="text-lg font-medium mb-1">No emails found</h3>
            <p className="text-muted-foreground text-sm">
              {searchQuery
                ? `No matching emails found for "${searchQuery}"`
                : `Your ${currentFolder} is empty`}
            </p>
          </div>
        ) : (
          emails.items.map((thread: EmailThread, index: number) => (
            <div key={thread.id} className="flex items-center gap-2 group">
              {isSelectMode && (
                <Checkbox 
                  checked={selectedThreadIds.includes(thread.id)}
                  onCheckedChange={() => handleSelectThreadForBatch(thread.id)}
                  aria-label={`Select email ${thread.subject}`}
                  className="mt-3 ml-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSelectThreadForBatch(thread.id);
                    }
                  }}
                />
              )}
              <div 
                className="flex-1"
                onClick={(e) => {
                  if (isSelectMode) {
                    if (e.shiftKey) {
                      handleRangeSelect(thread.id, index);
                    } else {
                      handleSelectThreadForBatch(thread.id);
                    }
                  } else {
                    onSelectThread(thread);
                  }
                }}
              >
                <EmailThreadItem
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThreadId === thread.id || selectedThreadIds.includes(thread.id)}
                  onSelect={(t) => {
                    if (isSelectMode) {
                      handleSelectThreadForBatch(t.id);
                    } else {
                      onSelectThread(t);
                    }
                  }}
                  onToggleStar={handleToggleStar}
                  availableLabels={labelsData?.labels || mockLabels}
                  className="flex-1"
                />
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Pagination */}
      {!isLoading && emails.total > 0 && (
        <div className="pt-4 border-t mt-auto">
          <EmailPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
          <div className="mt-2 text-center text-xs text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, emails.total)} of {emails.total} emails
          </div>
        </div>
      )}
      
      {/* Keyboard shortcuts hint */}
      {isSelectMode && (
        <div className="text-xs text-muted-foreground mt-2 text-center border-t pt-2">
          <span className="inline-block px-1.5 py-0.5 bg-muted rounded mr-1">Shift+A</span> Select all 
          <span className="inline-block px-1.5 py-0.5 bg-muted rounded mx-1">Shift+Click</span> Select range 
          <span className="inline-block px-1.5 py-0.5 bg-muted rounded mx-1">Esc</span> Cancel selection
        </div>
      )}
    </div>
  );
}
