import React from 'react';
import { motion } from 'framer-motion';
import { Star, StarOff, Paperclip, Tag } from 'lucide-react';
import { EmailThread, EmailLabel } from '@/lib/email/email-types';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EmailThreadItemProps {
  thread: EmailThread;
  isSelected: boolean;
  onSelect: (thread: EmailThread) => void;
  onToggleStar: (threadId: string, isStarred: boolean) => void;
  availableLabels: EmailLabel[];
  className?: string;
}

export function EmailThreadItem({
  thread,
  isSelected,
  onSelect,
  onToggleStar,
  availableLabels,
  className = '',
}: EmailThreadItemProps) {
  const lastMessage = thread.messages[thread.messages.length - 1];
  const isStarred = lastMessage.isStarred;
  const hasAttachments = lastMessage.attachments.length > 0;
  const fromName = lastMessage.from.name;
  
  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  // Format the date
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
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
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      onClick={() => onSelect(thread)}
      className={cn(
        'cursor-pointer rounded-md p-3 border transition-all',
        thread.isUnread 
          ? 'border-primary/20 bg-primary/5' 
          : 'border-border bg-card hover:bg-accent/50',
        isSelected ? 'ring-2 ring-primary border-transparent' : '',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={lastMessage.from.avatar} alt={fromName} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(fromName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 
              className={cn(
                'text-sm font-medium truncate',
                thread.isUnread ? 'font-semibold' : ''
              )}
            >
              {fromName}
              {thread.participants.length > 1 && (
                <span className="text-muted-foreground font-normal">
                  {` & ${thread.participants.length - 1} ${
                    thread.participants.length === 2 ? 'other' : 'others'
                  }`}
                </span>
              )}
            </h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
              {formatDate(lastMessage.date)}
            </span>
          </div>
          
          <h3 
            className={cn(
              'text-sm truncate mt-0.5', 
              thread.isUnread ? 'font-medium' : 'text-muted-foreground'
            )}
          >
            {thread.subject}
          </h3>
          
          <p className="text-xs text-muted-foreground truncate mt-1">
            {lastMessage.contentPreview}
          </p>
        </div>
      </div>
      
      {/* Bottom row with actions and labels */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(thread.id, !isStarred);
            }}
            className="text-muted-foreground hover:text-yellow-400 transition-colors"
            aria-label={isStarred ? 'Unstar' : 'Star'}
          >
            {isStarred ? (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff className="h-4 w-4" />
            )}
          </button>
          
          {hasAttachments && (
            <span className="text-muted-foreground" title="Has attachments">
              <Paperclip className="h-4 w-4" />
            </span>
          )}
          
          <div className="flex items-center gap-1 ml-1">
            {threadLabels.slice(0, 3).map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                style={{ 
                  backgroundColor: `${label.color}20`, 
                  color: label.color,
                  borderColor: `${label.color}40`
                }}
                className="px-1.5 py-0 h-5 text-[10px]"
              >
                {label.name}
              </Badge>
            ))}
            
            {threadLabels.length > 3 && (
              <Badge
                variant="outline"
                className="px-1.5 py-0 h-5 text-[10px]"
              >
                +{threadLabels.length - 3}
              </Badge>
            )}
          </div>
        </div>
        
        {thread.isUnread && (
          <div className="w-2 h-2 rounded-full bg-primary" aria-label="Unread" />
        )}
      </div>
    </motion.div>
  );
} 