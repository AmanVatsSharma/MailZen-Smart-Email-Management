import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { EmailParticipant, EmailThread } from '@/lib/email/email-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogClose,
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
  PenLine,
  Trash2 as TrashIcon,
  Smile,
  Send,
  Plus,
  Loader2,
  MinusCircle,
  FileText,
  Image as ImageIcon,
  Film
} from 'lucide-react';
import { useMutation } from '@apollo/client';
import { SEND_EMAIL } from '@/lib/apollo/queries/emails';
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
  const { toast } = useToast();

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
  const [sendEmail] = useMutation(SEND_EMAIL);

  const composerTitle = useMemo(() => {
    return mode === 'new' ? 'New Message' : mode === 'reply' ? 'Reply' : 'Forward';
  }, [mode]);

  useEffect(() => {
    // Debug-only log to help trace composer lifecycle issues later.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[EmailComposer] open change', { isOpen, mode });
    }
  }, [isOpen, mode]);

  // Handle file selection for attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[EmailComposer] attachments selected', { count: newFiles.length });
      }
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  // Handle removing an attachment
  const handleRemoveAttachment = (index: number) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[EmailComposer] attachment removed', { index });
    }
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle opening file dialog
  const handleAddAttachment = () => {
    fileInputRef.current?.click();
  };

  // Handle sending the email
  const handleSendEmail = async () => {
    // Parse the string inputs to create participant objects.
    const parseRecipients = (recipientString: string): EmailParticipant[] => {
      return recipientString
        .split(',')
        .map((raw) => raw.trim())
        .filter(Boolean)
        .map((email) => ({
          name: email.split('@')[0] || email,
          email,
        }));
    };

    const toRecipients = parseRecipients(to);
    const ccRecipients = parseRecipients(cc);
    const bccRecipients = parseRecipients(bcc);

    // Frontend validations (fast feedback, better UX).
    if (toRecipients.length === 0) {
      toast({
        title: 'Add at least one recipient',
        description: 'Please enter a valid email in the “To” field.',
        variant: 'destructive',
      });
      return;
    }

    if (isScheduled && !scheduledDate) {
      toast({
        title: 'Pick a schedule date',
        description: 'Choose a date in Schedule Send (or disable scheduling).',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[EmailComposer] send start', {
        mode,
        toCount: toRecipients.length,
        ccCount: ccRecipients.length,
        bccCount: bccRecipients.length,
        attachments: attachments.length,
        scheduled: isScheduled,
      });
    }

    try {
      await sendEmail({
        variables: {
          input: {
            subject: emailSubject,
            content,
            receiver: toRecipients,
            cc: ccRecipients.length > 0 ? ccRecipients : undefined,
            bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
            attachments:
              attachments.length > 0
                ? attachments.map((file) => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                  }))
                : undefined,
            scheduledDate: isScheduled ? scheduledDate?.toISOString() : undefined,
            replyToMessageId: mode === 'reply' && replyToThread ? replyToThread.id : undefined,
          },
        },
      });

      toast({
        title: isScheduled ? 'Email scheduled' : 'Email sent',
        description: isScheduled
          ? `Scheduled for ${scheduledDate?.toLocaleString()}`
          : 'Your email has been sent successfully',
      });

      onClose();
    } catch (error: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[EmailComposer] send failed', error);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Failed to send email',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[EmailComposer] send end');
      }
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Radix Dialog closes on overlay click / ESC; we map that back to parent state.
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="p-0 overflow-hidden sm:max-w-[980px] max-h-[90vh] bg-background/70 backdrop-blur-xl border-slate-200/40 dark:border-slate-800/40"
      >
        <div className="flex flex-col max-h-[90vh]">
          {/* Composer header */}
          <div className="p-4 border-b flex items-center justify-between bg-background/50 backdrop-blur-md">
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-semibold tracking-tight truncate">
                {composerTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isScheduled ? 'Scheduled send enabled' : 'Send now'}
              </p>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close composer">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>

          {/* Composer body */}
          <div className="flex-1 overflow-auto p-4 md:p-5 min-h-[420px]">
          {/* Recipients */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-16 text-sm font-medium">To:</div>
              <div className="flex-1">
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Add recipients..."
                  className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
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
                      className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
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
                      className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
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
                  className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
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
            <div className="mt-4 border rounded-md p-3 bg-background/40 backdrop-blur-sm">
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
        <div className="p-4 border-t flex items-center justify-between bg-background/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Button 
              variant="premium" 
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
                  <ImageIcon className="h-4 w-4 mr-2" />
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
                    if (process.env.NODE_ENV !== 'production') {
                      console.warn('[EmailComposer] schedule set', { date: date?.toISOString() });
                    }
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
                      if (process.env.NODE_ENV !== 'production') {
                        console.warn('[EmailComposer] schedule cleared');
                      }
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
