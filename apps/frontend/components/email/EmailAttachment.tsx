import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Paperclip, FileText, Image, FileArchive, Film, Music, Code, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmailAttachment as EmailAttachmentType } from '@/lib/email/email-types';

interface EmailAttachmentProps {
  attachment: File | EmailAttachmentType;
  onRemove?: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
  canDownload?: boolean;
  className?: string;
  showPreview?: boolean;
}

export function EmailAttachment({
  attachment,
  onRemove,
  isUploading = false,
  uploadProgress = 0,
  canDownload = false,
  className = '',
  showPreview = false
}: EmailAttachmentProps) {
  // Determine if we're dealing with a File or EmailAttachmentType
  const isFile = attachment instanceof File;
  
  // Get attachment details
  const name = isFile ? attachment.name : (attachment as EmailAttachmentType).name;
  const size = isFile ? attachment.size : (attachment as EmailAttachmentType).size;
  const type = isFile ? attachment.type : (attachment as EmailAttachmentType).type;
  const url = !isFile ? (attachment as EmailAttachmentType).url : undefined;

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
    const megabytes = kilobytes / 1024;
    return `${megabytes.toFixed(1)} MB`;
  };

  // Determine file icon based on mime type
  const getFileIcon = () => {
    if (type.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (type.startsWith('video/')) return <Film className="h-5 w-5" />;
    if (type.startsWith('audio/')) return <Music className="h-5 w-5" />;
    if (type.startsWith('text/')) return <FileText className="h-5 w-5" />;
    if (type.includes('zip') || type.includes('compressed')) return <FileArchive className="h-5 w-5" />;
    if (type.includes('code') || type.includes('json') || type.includes('javascript')) return <Code className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };
  
  // Generate preview URL for image attachments
  const imagePreviewUrl = React.useMemo(() => {
    if (showPreview && type.startsWith('image/')) {
      if (url) return url;
      if (isFile) return URL.createObjectURL(attachment as File);
    }
    return null;
  }, [attachment, type, url, showPreview, isFile]);
  
  // Handle file download
  const handleDownload = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 border rounded-md hover:bg-accent/50 transition-colors group",
      className
    )}>
      {/* If it's an image and we want to show previews */}
      {imagePreviewUrl && (
        <div 
          className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center"
          style={{ backgroundImage: `url(${imagePreviewUrl})`, backgroundSize: 'cover' }}
        >
        </div>
      )}
      
      {/* For non-image files or when not showing previews */}
      {!imagePreviewUrl && (
        <div className="p-2 bg-muted rounded flex items-center justify-center">
          {getFileIcon()}
        </div>
      )}
      
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {canDownload && url ? (
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-primary hover:underline transition-colors"
            >
              {name}
            </a>
          ) : (
            <span>{name}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{formatFileSize(size)}</span>
          
          {isUploading && (
            <div className="flex-1 max-w-32">
              <Progress value={uploadProgress} className="h-1" />
            </div>
          )}
          
          {isUploading && (
            <span className="text-xs">{uploadProgress}%</span>
          )}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {canDownload && url && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleDownload}
                >
                  <Paperclip className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {onRemove && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-50 group-hover:opacity-100"
                  onClick={onRemove}
                  disabled={isUploading}
                >
                  <X className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// A component for multiple attachments
export function EmailAttachmentList({
  attachments,
  onRemove,
  isUploading,
  uploadProgress,
  canDownload,
  showPreview = false,
  className = ''
}: {
  attachments: (File | EmailAttachmentType)[];
  onRemove?: (index: number) => void;
  isUploading?: boolean[];
  uploadProgress?: number[];
  canDownload?: boolean;
  showPreview?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2", className)}>
      {attachments.map((attachment, index) => (
        <EmailAttachment
          key={index}
          attachment={attachment}
          onRemove={onRemove ? () => onRemove(index) : undefined}
          isUploading={isUploading ? isUploading[index] : false}
          uploadProgress={uploadProgress ? uploadProgress[index] : 0}
          canDownload={canDownload}
          showPreview={showPreview}
        />
      ))}
    </div>
  );
} 