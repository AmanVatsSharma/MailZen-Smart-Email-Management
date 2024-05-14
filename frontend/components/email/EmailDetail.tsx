'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Trash2,
  Archive,
  Reply,
  Forward,
  MoreHorizontal,
  Paperclip,
  Download,
  Star,
  Mail,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  File as FileIcon,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { SmartReplySelector } from './SmartReplySelector';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EmailThread, EmailLabel } from '@/lib/email/email-types';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation } from '@apollo/client';
import { GET_EMAIL, UPDATE_EMAIL } from '@/lib/apollo/queries/emails';
import DOMPurify from 'dompurify';
import { EmailAttachmentList } from './EmailAttachment';

// Mock email data for demonstration
const mockEmailDetails = {
  id: '1',
  from: {
    name: 'GitHub',
    email: 'noreply@github.com',
    avatar: null,
  },
  to: [{ name: 'Me', email: 'me@example.com' }],
  cc: [],
  bcc: [],
  subject: 'Action required: Your GitHub access will expire in 24 hours',
  date: new Date(2023, 2, 15, 10, 42),
  body: `
    <p>Hello,</p>
    <p>Your GitHub password will expire in 24 hours. To create a new password, click the link below:</p>
    <p><a href="#">Reset your password</a></p>
    <p>If you did not request this change, please contact us immediately.</p>
    <p>Best regards,<br>The GitHub Team</p>
  `,
  attachments: [] as Array<{ name: string; size: string }>,
  isStarred: false,
  isImportant: true,
};

interface EmailDetailProps {
  thread: EmailThread | null;
  availableLabels: EmailLabel[];
  onReply: (threadId: string) => void;
  onForward: (threadId: string) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onToggleStar: (threadId: string, isStarred: boolean) => void;
  onBackToPreview?: () => void;
  className?: string;
}

export function EmailDetail({
  thread,
  availableLabels,
  onReply,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  onBackToPreview,
  className = '',
}: EmailDetailProps) {
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [selectedSmartReply, setSelectedSmartReply] = useState<string | null>(null);
  
  // Fetch detailed email data if we have a selected thread
  const { data: emailData, loading: emailLoading } = useQuery(GET_EMAIL, {
    variables: { id: thread?.id },
    skip: !thread?.id,
    fetchPolicy: 'network-only'
  });
  
  // Update email mutation
  const [updateEmail] = useMutation(UPDATE_EMAIL);
  
  // Mark email as read when opened
  useEffect(() => {
    if (thread && thread.isUnread) {
      updateEmail({
        variables: {
          id: thread.id,
          input: {
            read: true
          }
        }
      }).catch(error => {
        console.error('Error marking email as read:', error);
      });
    }
  }, [thread?.id, thread?.isUnread, updateEmail]);
  
  // Handle toggling the star
  const handleToggleStar = () => {
    if (thread) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      // Call the API to update the star status
      updateEmail({
        variables: {
          id: thread.id,
          input: {
            starred: !lastMessage.isStarred
          }
        }
      }).then(() => {
        // Call the callback to update UI
        onToggleStar(thread.id, !lastMessage.isStarred);
      }).catch(error => {
        console.error('Error updating star status:', error);
      });
    }
  };

  // Within the EmailDetail component, add a ref for the content container
  const emailContentRef = useRef<HTMLDivElement>(null);

  // Add a function to safely render HTML content and adjust embedded content
  const sanitizeAndRenderHtml = (htmlContent: string) => {
    // Sanitize HTML to prevent XSS
    return DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3',
        'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'div', 'span', 'hr', 'img'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'style', 'class', 'target', 'rel', 'width',
        'height', 'align'
      ]
    });
  };

  // Add a useEffect to process content after render
  useEffect(() => {
    if (emailContentRef.current && thread) {
      // Process content
      const processContent = () => {
        const links = emailContentRef.current?.querySelectorAll('a');
        
        // Make all links open in new tab
        if (links) {
          links.forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          });
        }
        
        // Make images responsive and add lightbox behavior
        const images = emailContentRef.current?.querySelectorAll('img');
        if (images) {
          images.forEach(img => {
            img.classList.add('max-w-full', 'h-auto');
            img.addEventListener('click', () => {
              // Could implement lightbox here
              console.log('Image clicked:', img.src);
            });
          });
        }
      };
      
      // Run processing
      processContent();
    }
  }, [thread]);

  if (!thread) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-center p-8 ${className}`}>
        <div className="p-6 rounded-full bg-primary/10 mb-4">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-medium mb-2">No email selected</h3>
        <p className="text-muted-foreground">
          Select an email from the list to view its content
        </p>
      </div>
    );
  }

  // Format timestamp to relative time
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return dateStr;
    }
  };
  
  // Get absolute timestamp
  const getFullDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch (error) {
      return dateStr;
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Get file size in human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Get labels for the thread
  const threadLabels = thread.labelIds
    ? thread.labelIds
        .map(id => availableLabels.find(label => label.id === id))
        .filter(Boolean) as EmailLabel[]
    : [];

  // Last message in thread
  const lastMessage = thread.messages[thread.messages.length - 1];
    
  // Add a function to get appropriate icon for file type
  const getFileIcon = (fileType: string) => {
    const fileTypeMap: Record<string, React.ReactNode> = {
      'image': <FileImage className="h-4 w-4" />,
      'audio': <FileAudio className="h-4 w-4" />,
      'video': <FileVideo className="h-4 w-4" />,
      'application/pdf': <FileText className="h-4 w-4" />,
      'application/msword': <FileText className="h-4 w-4" />,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': <FileText className="h-4 w-4" />,
      'application/vnd.ms-excel': <FileSpreadsheet className="h-4 w-4" />,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileSpreadsheet className="h-4 w-4" />,
      'application/zip': <FileArchive className="h-4 w-4" />,
      'application/x-zip-compressed': <FileArchive className="h-4 w-4" />,
    };

    // Check if type starts with any of the keys (for mime types like image/jpeg)
    for (const key in fileTypeMap) {
      if (fileType.startsWith(key)) {
        return fileTypeMap[key];
      }
    }

    // Default icon
    return <FileIcon className="h-4 w-4" />;
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Header with actions */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {onBackToPreview && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onBackToPreview}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <h2 className="text-xl font-semibold truncate">{thread.subject}</h2>
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onReply(thread.id)}
            aria-label="Reply"
          >
            <Reply className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onForward(thread.id)}
            aria-label="Forward"
          >
            <Forward className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onArchive(thread.id)}
            aria-label="Archive"
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onDelete(thread.id)}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleToggleStar}
            aria-label={lastMessage.isStarred ? "Unstar" : "Star"}
            className={lastMessage.isStarred ? "text-yellow-400" : ""}
          >
            <Star className={`h-4 w-4 ${lastMessage.isStarred ? "fill-yellow-400" : ""}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                <DropdownMenuItem>Add to favorites</DropdownMenuItem>
                <DropdownMenuItem>Print</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Report spam</DropdownMenuItem>
                <DropdownMenuItem>Block sender</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Labels (if any) */}
      {threadLabels.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1 border-b">
          {threadLabels.map((label) => (
            <Badge
              key={label.id}
              variant="outline"
              style={{ 
                backgroundColor: `${label.color}20`, 
                color: label.color,
                borderColor: `${label.color}40`
              }}
              className="px-2 py-0.5 h-6"
            >
              {label.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Thread messages */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {thread.messages.map((message, index) => (
            <motion.div 
              key={message.id} 
              className={cn(
                "border rounded-lg overflow-hidden",
                message.from.email === "you@example.com" ? "border-primary/20 bg-primary/5" : "border-border"
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              {/* Message header */}
              <div className="flex items-start justify-between p-4 bg-muted/30">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={message.from.avatar} alt={message.from.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(message.from.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{message.from.name}</div>
                    <div className="text-sm text-muted-foreground">{message.from.email}</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground" title={getFullDate(message.date)}>
                  {formatDate(message.date)}
                </div>
              </div>

              {/* Recipients */}
              <div className="px-4 py-2 text-xs text-muted-foreground border-b">
                <span className="font-medium">To: </span>
                {message.to.map((recipient) => recipient.name).join(', ')}
                {message.cc && message.cc.length > 0 && (
                  <>
                    <br />
                    <span className="font-medium">Cc: </span>
                    {message.cc.map((recipient) => recipient.name).join(', ')}
                  </>
                )}
              </div>

              {/* Message content */}
              <div 
                ref={emailContentRef}
                className="p-4 prose prose-sm max-w-none overflow-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeAndRenderHtml(message.content) }}
              />

              {/* Attachments if any */}
              {message.attachments.length > 0 && (
                <div className="border-t p-4">
                  <h4 className="text-sm font-medium mb-2">Attachments ({message.attachments.length})</h4>
                  <EmailAttachmentList 
                    attachments={message.attachments}
                    canDownload={true}
                    showPreview={true}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick reply at bottom */}
      <div className="p-4 border-t">
        <div 
          className="p-3 border rounded-lg bg-muted/30 text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
          onClick={() => onReply(thread.id)}
        >
          Click here to reply...
        </div>
      </div>
    </div>
  );
}
