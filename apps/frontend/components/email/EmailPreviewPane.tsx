'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft,
  Star,
  Trash2,
  Archive,
  Reply,
  Forward,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmailThread, EmailLabel } from '@/lib/email/email-types';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { EmailAttachmentList } from './EmailAttachment';

interface EmailPreviewPaneProps {
  thread: EmailThread | null;
  availableLabels: EmailLabel[];
  onViewFull: () => void;
  onReply: (threadId: string) => void;
  onForward: (threadId: string) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onToggleStar: (threadId: string, isStarred: boolean) => void;
  className?: string;
}

export function EmailPreviewPane({
  thread,
  availableLabels,
  onViewFull,
  onReply,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  className = '',
}: EmailPreviewPaneProps) {
  if (!thread) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground", className)}>
        Select an email to preview
      </div>
    );
  }
  
  // Get the latest message from the thread
  const lastMessage = thread.messages[thread.messages.length - 1];
  
  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  // Format timestamp to relative time
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return dateStr;
    }
  };
  
  // Get labels for the thread
  const threadLabels = thread.labelIds
    ? thread.labelIds
        .map(id => availableLabels.find(label => label.id === id))
        .filter(Boolean) as EmailLabel[]
    : [];
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="font-normal"
            onClick={onViewFull}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <h3 className="font-medium line-clamp-1">{thread.subject}</h3>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={lastMessage.isStarred ? "text-yellow-400" : ""}
            onClick={() => onToggleStar(thread.id, !lastMessage.isStarred)}
          >
            <Star className={`h-4 w-4 ${lastMessage.isStarred ? "fill-yellow-400" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onArchive(thread.id)}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(thread.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Email metadata */}
      <div className="p-4 bg-muted/10">
        <div className="flex items-start">
          <Avatar className="h-10 w-10 mr-3">
            <AvatarImage src={lastMessage.from.avatar} alt={lastMessage.from.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(lastMessage.from.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{lastMessage.from.name}</h4>
              <span className="text-xs text-muted-foreground">{formatDate(lastMessage.date)}</span>
            </div>
            
            <div className="text-xs text-muted-foreground mb-1">
              <span>To: {lastMessage.to.map(p => p.name).join(', ')}</span>
              {lastMessage.cc && lastMessage.cc.length > 0 && (
                <span> • Cc: {lastMessage.cc.map(p => p.name).join(', ')}</span>
              )}
            </div>
            
            {threadLabels.length > 0 && (
              <div className="flex flex-wrap gap-1 my-2">
                {threadLabels.map(label => (
                  <Badge
                    key={label.id}
                    variant="outline"
                    style={{ 
                      backgroundColor: `${label.color}20`, 
                      color: label.color,
                      borderColor: `${label.color}40`
                    }}
                    className="text-xs px-1.5 py-0 h-5"
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Separator />
      
      {/* Email content preview */}
      <div className="p-4 flex-1 overflow-auto">
        <div className="prose prose-sm max-w-none">
          <div dangerouslySetInnerHTML={{ __html: lastMessage.content.substring(0, 500) }} />
          {lastMessage.content.length > 500 && (
            <div className="text-primary font-medium cursor-pointer mt-2" onClick={onViewFull}>
              View full message
            </div>
          )}
        </div>
        
        {/* Attachments */}
        {lastMessage.attachments.length > 0 && (
          <div className="mt-4 border-t pt-3 px-2">
            <div className="flex items-center text-sm mb-2">
              <Paperclip className="h-4 w-4 mr-1" />
              <span className="font-medium">
                {lastMessage.attachments.length} {lastMessage.attachments.length === 1 ? 'attachment' : 'attachments'}
              </span>
            </div>
            {lastMessage.attachments.length <= 3 ? (
              <EmailAttachmentList 
                attachments={lastMessage.attachments}
                canDownload={true}
                className="flex flex-col space-y-2"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {lastMessage.attachments.slice(0, 3).map(attachment => (
                  <div key={attachment.id} className="border rounded px-2 py-1 text-xs flex items-center">
                    <span className="mr-1 truncate max-w-[120px]">{attachment.name}</span>
                  </div>
                ))}
                <div className="border rounded px-2 py-1 text-xs text-muted-foreground">
                  +{lastMessage.attachments.length - 3} more
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="p-3 border-t">
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="secondary" 
              size="sm" 
              className="mr-2"
              onClick={() => onReply(thread.id)}
            >
              <Reply className="h-3.5 w-3.5 mr-1" />
              Reply
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onForward(thread.id)}
            >
              <Forward className="h-3.5 w-3.5 mr-1" />
              Forward
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onViewFull}>
            View full message
          </Button>
        </div>
      </div>
    </div>
  );
} 