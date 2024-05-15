'use client';

import React, { useState } from 'react';
import { 
  Inbox, 
  Send, 
  FilePen, 
  AlertCircle, 
  Archive, 
  Trash, 
  Tag, 
  FolderPlus, 
  PlusCircle,
  ChevronRight,
  ChevronDown,
  Settings,
  Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { EmailFolder, EmailLabel } from '@/lib/email/email-types';
import { useQuery } from '@apollo/client';
import { GET_FOLDERS, GET_LABELS } from '@/lib/apollo/queries/emails';

interface EmailNavigationProps {
  currentFolder: EmailFolder;
  onFolderSelect: (folder: EmailFolder) => void;
  currentLabel?: string;
  onLabelSelect: (labelId: string) => void;
  className?: string;
}

interface FolderItem {
  id: string;
  name: string;
  count: number;
  unreadCount: number;
}

// Extended Label interface for UI purposes
interface LabelWithCount extends EmailLabel {
  count: number;
}

export function EmailNavigation({
  currentFolder,
  onFolderSelect,
  currentLabel,
  onLabelSelect,
  className = '',
}: EmailNavigationProps) {
  const [labelsExpanded, setLabelsExpanded] = useState(true);
  
  // Fetch folders and counts
  const { data: foldersData, loading: foldersLoading } = useQuery(GET_FOLDERS);
  
  // Fetch labels
  const { data: labelsData, loading: labelsLoading } = useQuery(GET_LABELS);
  
  // Get folder data with counts
  const folders = foldersData?.folders || [
    { id: 'inbox', name: 'Inbox', count: 24, unreadCount: 5 },
    { id: 'sent', name: 'Sent', count: 12, unreadCount: 0 },
    { id: 'drafts', name: 'Drafts', count: 3, unreadCount: 0 },
    { id: 'spam', name: 'Spam', count: 8, unreadCount: 2 },
    { id: 'trash', name: 'Trash', count: 15, unreadCount: 0 },
    { id: 'archive', name: 'Archive', count: 42, unreadCount: 0 },
  ];
  
  // Get labels
  const labels = labelsData?.labels || [
    { id: 'label-1', name: 'Important', color: '#ef4444', count: 8 },
    { id: 'label-2', name: 'Work', color: '#3b82f6', count: 12 },
    { id: 'label-3', name: 'Personal', color: '#10b981', count: 5 },
    { id: 'label-4', name: 'Finance', color: '#f59e0b', count: 3 },
  ];
  
  // Get folder icon
  const getFolderIcon = (folderId: string) => {
    switch (folderId) {
      case 'inbox':
        return <Inbox className="h-4 w-4" />;
      case 'sent':
        return <Send className="h-4 w-4" />;
      case 'drafts':
        return <FilePen className="h-4 w-4" />;
      case 'spam':
        return <AlertCircle className="h-4 w-4" />;
      case 'trash':
        return <Trash className="h-4 w-4" />;
      case 'archive':
        return <Archive className="h-4 w-4" />;
      default:
        return <Inbox className="h-4 w-4" />;
    }
  };
  
  return (
    <div className={cn("w-56 flex flex-col h-full border-r", className)}>
      {/* Create new email button */}
      <div className="p-4">
        <Button className="w-full gap-2" size="sm">
          <PlusCircle className="h-4 w-4" />
          Compose
        </Button>
      </div>
      
      {/* Folders list */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2">
          <div className="mb-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
              FOLDERS
            </h3>
            <div className="space-y-1">
              {folders.map((folder: FolderItem) => (
                <Button
                  key={folder.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start font-normal",
                    currentFolder === folder.id && "bg-accent text-accent-foreground font-medium"
                  )}
                  onClick={() => onFolderSelect(folder.id as EmailFolder)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {getFolderIcon(folder.id)}
                      <span>{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {folder.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 px-1.5">
                          {folder.unreadCount}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {folder.count}
                      </span>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
          
          {/* Labels section */}
          <div className="mb-4">
            <div 
              className="flex items-center justify-between mb-2 px-2 cursor-pointer hover:text-foreground"
              onClick={() => setLabelsExpanded(!labelsExpanded)}
            >
              <h3 className="text-xs font-medium text-muted-foreground flex items-center">
                {labelsExpanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                LABELS
              </h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open label management
                        console.log('Open label management');
                      }}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manage labels</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {labelsExpanded && (
              <div className="space-y-1">
                {labels.map((label: LabelWithCount) => (
                  <Button
                    key={label.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start font-normal",
                      currentLabel === label.id && "bg-accent text-accent-foreground font-medium"
                    )}
                    onClick={() => onLabelSelect(label.id)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: label.color }}
                        />
                        <span>{label.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {label.count}
                      </span>
                    </div>
                  </Button>
                ))}
                
                {/* Create new label button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal text-primary"
                >
                  <div className="flex items-center gap-2">
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Create new label</span>
                  </div>
                </Button>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
      
      {/* Storage usage indicator */}
      <div className="p-3 border-t">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">Storage</span>
          <span className="font-medium">65% used</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: '65%' }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          13.1 GB of 20 GB used
        </p>
      </div>
    </div>
  );
} 