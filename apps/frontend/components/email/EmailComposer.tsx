import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { EmailParticipant, EmailThread } from '@/lib/email/email-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import {
  Paperclip,
  X,
  ChevronDown,
  Clock,
  Calendar as CalendarIcon,
  PenLine,
  Trash2 as TrashIcon,
  Smile,
  Send,
  Plus,
  Loader2,
  MinusCircle,
  FileText,
  Image,
  Film
} from 'lucide-react';
import { useMutation } from '@apollo/client';
import { SEND_EMAIL } from '@/lib/apollo/queries/emails';
import { toast } from '@/components/ui/use-toast';
import { useToast } from '@/components/ui/use-toast';
import { EmailAttachmentList } from './EmailAttachment';

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  replyToThread?: EmailThread;
  threadRecipients?: EmailParticipant[];
  subject?: string;
  mode?: 'new' | 'reply' | 'forward';
  initialContent?: string;
}

export function EmailComposer({
  isOpen,
  onClose,
  replyToThread,
  threadRecipients = [],
  subject = '',
  mode = 'new',
  initialContent = '',
}: EmailComposerProps) {
  const [to, setTo] = useState<string>(
    mode === 'reply' ? threadRecipients.map(r => r.email).join(', ') : ''
  );
  const [cc, setCc] = useState<string>('');
  const [bcc, setBcc] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>(
    mode === 'reply' ? `Re: ${subject}` : mode === 'forward' ? `Fwd: ${subject}` : subject
  );
  const [content, setContent] = useState<string>(initialContent);
  const [showCc, setShowCc] = useState<boolean>(false);
  const [showBcc, setShowBcc] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [isSending, setIsSending] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apollo Client mutation for sending emails
  const [sendEmail, { loading }] = useMutation(SEND_EMAIL);

  // Handle file selection for attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  // Handle removing an attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle opening file dialog
  const handleAddAttachment = () => {
    fileInputRef.current?.click();
  };

  // Handle sending the email
  const handleSendEmail = () => {
    setIsSending(true);

    // Parse the string inputs to create participant objects
    const parseRecipients = (recipientString: string): EmailParticipant[] => {
      return recipientString.split(',').map(email => {
        const trimmedEmail = email.trim();
        return {
          name: trimmedEmail.split('@')[0] || trimmedEmail,
          email: trimmedEmail
        };
      }).filter(recipient => recipient.email !== '');
    };

    // Convert strings to EmailParticipant arrays
    const toRecipients = parseRecipients(to);
    const ccRecipients = parseRecipients(cc);
    const bccRecipients = parseRecipients(bcc);
    
    // Call the GraphQL mutation
    sendEmail({
      variables: {
        input: {
          subject: emailSubject,
          content: content,
          receiver: toRecipients,
          cc: ccRecipients.length > 0 ? ccRecipients : undefined,
          bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
          attachments: attachments.length > 0 ? attachments.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
          })) : undefined,
          scheduledDate: isScheduled ? scheduledDate?.toISOString() : undefined,
          replyToMessageId: mode === 'reply' && replyToThread ? replyToThread.id : undefined
        }
      }
    }).then(() => {
      // Show success message
      toast({
        title: 'Email sent',
        description: isScheduled 
          ? `Your email has been scheduled for ${scheduledDate?.toLocaleString()}`
          : 'Your email has been sent successfully',
      });
      onClose();
    }).catch(error => {
      // Show error message
      toast({
        title: 'Failed to send email',
        description: error.message,
        variant: 'destructive'
      });
    }).finally(() => {
      setIsSending(false);
    });
  };

  // Get file size display
  const getFileSize = (size: number) => {
    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="bg-background rounded-lg border shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Composer header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-medium">
            {mode === 'new' ? 'New Message' : mode === 'reply' ? 'Reply' : 'Forward'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close composer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Composer body */}
        <div className="flex-1 overflow-auto p-4 min-h-[400px]">
          {/* Recipients */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-16 text-sm font-medium">To:</div>
              <div className="flex-1">
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Add recipients..."
                  className="border-0 shadow-none focus-visible:ring-0 px-0"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6"
                onClick={() => {
                  setShowCc(true);
                  setShowBcc(true);
                }}
              >
                Cc/Bcc
              </Button>
            </div>

            <AnimatePresence>
              {showCc && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <div className="w-16 text-sm font-medium">Cc:</div>
                  <div className="flex-1">
                    <Input
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="Add CC recipients..."
                      className="border-0 shadow-none focus-visible:ring-0 px-0"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowCc(false)}
                    aria-label="Hide CC field"
                  >
                    <MinusCircle className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}

              {showBcc && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <div className="w-16 text-sm font-medium">Bcc:</div>
                  <div className="flex-1">
                    <Input
                      value={bcc}
                      onChange={(e) => setBcc(e.target.value)}
                      placeholder="Add BCC recipients..."
                      className="border-0 shadow-none focus-visible:ring-0 px-0"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowBcc(false)}
                    aria-label="Hide BCC field"
                  >
                    <MinusCircle className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              <div className="w-16 text-sm font-medium">Subject:</div>
              <div className="flex-1">
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject..."
                  className="border-0 shadow-none focus-visible:ring-0 px-0"
                />
              </div>
            </div>
          </div>

          {/* Content editor */}
          <div className="mt-2 border rounded-md overflow-hidden">
            <Tabs defaultValue="compose">
              <TabsList className="p-0 h-8 border-b bg-muted/50">
                <TabsTrigger value="compose" className="text-xs rounded-none h-8 px-3 data-[state=active]:bg-background">
                  Compose
                </TabsTrigger>
                <TabsTrigger value="format" className="text-xs rounded-none h-8 px-3 data-[state=active]:bg-background">
                  Format
                </TabsTrigger>
              </TabsList>
              <TabsContent value="compose" className="p-0 m-0">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your message here..."
                  className="min-h-[200px] border-0 rounded-none shadow-none focus-visible:ring-0 resize-none"
                />
              </TabsContent>
              <TabsContent value="format" className="p-2 m-0 border-b bg-muted/20">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" className="h-8">
                    <span className="font-bold">B</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8">
                    <span className="italic">I</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8">
                    <span className="underline">U</span>
                  </Button>
                  <div className="h-4 w-px bg-border"></div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        Paragraph <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>Paragraph</DropdownMenuItem>
                      <DropdownMenuItem>Heading 1</DropdownMenuItem>
                      <DropdownMenuItem>Heading 2</DropdownMenuItem>
                      <DropdownMenuItem>Heading 3</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        Font <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>Arial</DropdownMenuItem>
                      <DropdownMenuItem>Helvetica</DropdownMenuItem>
                      <DropdownMenuItem>Times New Roman</DropdownMenuItem>
                      <DropdownMenuItem>Courier</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="h-4 w-px bg-border"></div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <PenLine className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mt-4 border rounded-md p-3">
              <h3 className="text-sm font-medium mb-2">Attachments ({attachments.length})</h3>
              <EmailAttachmentList 
                attachments={attachments} 
                onRemove={handleRemoveAttachment}
                showPreview={true}
              />
            </div>
          )}
        </div>

        {/* Composer footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              className="gap-1"
              onClick={handleSendEmail}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send
                </>
              )}
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              multiple
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Attach files"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleAddAttachment}>
                  <FileText className="h-4 w-4 mr-2" />
                  <span>Attach Files</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                    // Reset accept after a short delay
                    setTimeout(() => {
                      if (fileInputRef.current) fileInputRef.current.accept = "";
                    }, 100);
                  }
                }}>
                  <Image className="h-4 w-4 mr-2" />
                  <span>Attach Images</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "video/*";
                    fileInputRef.current.click();
                    // Reset accept after a short delay
                    setTimeout(() => {
                      if (fileInputRef.current) fileInputRef.current.accept = "";
                    }, 100);
                  }
                }}>
                  <Film className="h-4 w-4 mr-2" />
                  <span>Attach Videos</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={isScheduled ? "default" : "outline"}
                  size="icon"
                  aria-label="Schedule send"
                  className={isScheduled ? "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary border-primary" : ""}
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-2 border-b">
                  <h3 className="font-medium">Schedule Send</h3>
                </div>
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={(date) => {
                    setScheduledDate(date);
                    setIsScheduled(!!date);
                  }}
                  initialFocus
                />
                <div className="p-2 border-t bg-muted/20 flex justify-between">
                  {isScheduled && scheduledDate && (
                    <div className="text-xs">
                      Scheduled for: {format(scheduledDate, 'PPP')}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-6"
                    onClick={() => {
                      setIsScheduled(false);
                      setScheduledDate(undefined);
                    }}
                  >
                    <TrashIcon className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Save as draft</DropdownMenuItem>
                <DropdownMenuItem>Insert signature</DropdownMenuItem>
                <DropdownMenuItem>Insert template</DropdownMenuItem>
                <DropdownMenuItem>Check spelling</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Discard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isScheduled && scheduledDate && (
            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              Scheduled for {format(scheduledDate, 'PPP')}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
