import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Film,
  Sparkles,
  WandSparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { SEND_EMAIL } from '@/lib/apollo/queries/emails';
import { GET_PROVIDERS } from '@/lib/apollo/queries/providers';
import { useToast } from '@/components/ui/use-toast';
import { EmailAttachmentList } from './EmailAttachment';
import { SmartReplySelector } from './SmartReplySelector';
import { ComposeCopilot } from './ComposeCopilot';
import { getUserData } from '@/lib/auth/auth-utils';

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
  const [showSmartReplies, setShowSmartReplies] = useState<boolean>(false);
  const [tone, setTone] = useState<'professional' | 'friendly' | 'concise' | 'formal'>('professional');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const AI_ACTIONS = [
    { label: '✨ Continue writing', key: 'continue' },
    { label: '🎩 Make more formal', key: 'formal' },
    { label: '✂️ Make shorter', key: 'shorter' },
    { label: '📢 Add call to action', key: 'cta' },
    { label: '😊 Make friendlier', key: 'friendly' },
  ] as const;

  const handleAiActionSelect = useCallback(
    async (actionKey: string) => {
      setShowAiMenu(false);
      // Strip the `//` trigger from the end of the content
      const stripped = content.replace(/\/\/$/, '').trimEnd();
      setContent(stripped);
      setIsAiGenerating(true);
      try {
        await new Promise((r) => setTimeout(r, 700));
        let suffix = '';
        if (actionKey === 'continue') suffix = ' I look forward to hearing your thoughts and discussing this further.';
        else if (actionKey === 'formal') suffix = '\n\nKindly acknowledge receipt of this correspondence at your earliest convenience.';
        else if (actionKey === 'shorter') {
          setContent((prev) => prev.split(' ').slice(0, 20).join(' ') + '...');
          return;
        } else if (actionKey === 'cta') suffix = '\n\nPlease reply to confirm or click the link below to take the next step.';
        else if (actionKey === 'friendly') suffix = '\n\nHope this makes sense! Feel free to ping me anytime 😊';
        setContent((prev) => (prev ? prev + suffix : suffix.trimStart()));
        toast({ title: 'AI applied', description: 'Content updated.' });
      } finally {
        setIsAiGenerating(false);
      }
    },
    [content, toast],
  );

  const TONES = [
    { value: 'professional', label: 'Professional' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'concise', label: 'Concise' },
    { value: 'formal', label: 'Formal' },
  ] as const;

  const SUBJECT_SUGGESTIONS = useMemo(() => {
    if (!emailSubject || emailSubject.length > 20) return [];
    if (mode === 'reply') return [];
    return [
      emailSubject ? `Following up: ${emailSubject}` : 'Following up on our conversation',
      emailSubject ? `Re: ${emailSubject} — Action Required` : 'Action Required',
    ].filter((s) => s !== emailSubject);
  }, [emailSubject, mode]);

  const handleAiDraft = async () => {
    if (!content && !emailSubject) {
      toast({ title: 'Add some context', description: 'Enter a subject or a few words in the body to generate a draft.' });
      return;
    }
    setIsAiGenerating(true);
    try {
      // In production this would call the AI agent platform via GraphQL.
      // For now, compose a structured placeholder the backend can hydrate.
      await new Promise((r) => setTimeout(r, 900));
      const stub = `[AI Draft — ${tone} tone]\n\nDear recipient,\n\nI hope this message finds you well. ${emailSubject ? `Regarding "${emailSubject}", ` : ''}I wanted to reach out to discuss next steps.\n\nPlease let me know your availability.\n\nBest regards`;
      setContent(stub);
      toast({ title: 'Draft ready', description: 'AI draft inserted — edit as needed before sending.' });
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Apollo Client mutation for sending emails
  const [sendEmail] = useMutation(SEND_EMAIL);
  const { data: providersData } = useQuery(GET_PROVIDERS, {
    fetchPolicy: 'cache-first',
  });
  const providers =
    ((providersData?.providers as
      | { id: string; email: string; isActive: boolean }[]
      | undefined) ?? []);
  const activeProvider = providers.find((provider) => provider.isActive) ?? providers[0];
  const fromAddress = activeProvider?.email || getUserData()?.email || '';

  const composerTitle = useMemo(() => {
    return mode === 'new' ? 'New Message' : mode === 'reply' ? 'Reply' : 'Forward';
  }, [mode]);

  useEffect(() => {
    // Debug-only log to help trace composer lifecycle issues later.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[EmailComposer] open change', { isOpen, mode });
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;

    setTo(mode === 'reply' ? threadRecipients.map((recipient) => recipient.email).join(', ') : '');
    setCc('');
    setBcc('');
    setEmailSubject(
      mode === 'reply'
        ? `Re: ${subject}`
        : mode === 'forward'
          ? `Fwd: ${subject}`
          : subject,
    );
    setContent(initialContent);
  }, [initialContent, isOpen, mode, subject, threadRecipients]);

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
    // Parse recipient strings as plain email arrays for backend SendEmailInput.
    const parseRecipients = (recipientString: string): string[] => {
      return recipientString
        .split(',')
        .map((raw) => raw.trim())
        .filter(Boolean);
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

    if (!activeProvider?.id) {
      toast({
        title: 'No email provider connected',
        description: 'Connect and activate a provider before sending emails.',
        variant: 'destructive',
      });
      return;
    }

    if (!fromAddress) {
      toast({
        title: 'Missing sender address',
        description: 'Unable to resolve your sender email address.',
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
            body: content,
            from: fromAddress,
            to: toRecipients,
            providerId: activeProvider.id,
            scheduledAt: isScheduled ? scheduledDate?.toISOString() : undefined,
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={isMinimized ? 'Expand composer' : 'Minimize composer'}
                onClick={() => setIsMinimized((v) => !v)}
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close composer">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>

          {/* Composer body — collapses when minimized */}
          <AnimatePresence initial={false}>
          {!isMinimized && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
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

            {/* Subject line AI suggestions */}
            <AnimatePresence>
              {SUBJECT_SUGGESTIONS.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 pl-[72px]">
                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Suggested:</span>
                    {SUBJECT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEmailSubject(s)}
                        className="text-[11px] text-primary/80 hover:text-primary underline underline-offset-2 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {mode === 'reply' && replyToThread && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowSmartReplies(s => !s)}
              >
                <Sparkles className="h-4 w-4" />
                {showSmartReplies ? 'Hide Smart Replies' : 'Show Smart Replies'}
              </Button>

              {showSmartReplies && (
                <div className="mt-3">
                  <SmartReplySelector
                    emailContent={
                      replyToThread.messages && replyToThread.messages.length > 0
                        ? replyToThread.messages[replyToThread.messages.length - 1].contentPreview ||
                          replyToThread.messages[replyToThread.messages.length - 1].content ||
                          ''
                        : ''
                    }
                    onSelectReply={(text) => {
                      setContent(text);
                      setShowSmartReplies(false);
                      toast({
                        title: 'Inserted',
                        description: 'Smart reply inserted into your draft.',
                      });
                    }}
                  />
                </div>
              )}
            </div>
          )}

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
              <TabsContent value="compose" className="p-0 m-0 relative">
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContent(val);
                    // Show AI menu when user types `//` at end of current line
                    if (val.endsWith('//')) {
                      setShowAiMenu(true);
                    } else {
                      setShowAiMenu(false);
                    }
                  }}
                  placeholder="Write your message here… type // for AI actions"
                  className="min-h-[200px] border-0 rounded-none shadow-none focus-visible:ring-0 resize-none"
                />
                {/* // AI floating action menu */}
                <AnimatePresence>
                  {showAiMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-4 bottom-2 z-50 w-56 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b bg-muted/50">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <WandSparkles className="h-3 w-3 text-primary" /> AI actions
                        </p>
                      </div>
                      {AI_ACTIONS.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => handleAiActionSelect(action.key)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                      <div className="px-3 py-1.5 border-t">
                        <button
                          type="button"
                          onClick={() => setShowAiMenu(false)}
                          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
                        >
                          Esc to dismiss
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

          </motion.div>
          )}
          </AnimatePresence>

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

            {/* AI Draft button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleAiDraft}
              disabled={isAiGenerating}
            >
              {isAiGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <WandSparkles className="h-3.5 w-3.5" />
              )}
              AI Draft
            </Button>

            {/* Copilot panel (tone + body actions + subject suggestions) */}
            <ComposeCopilot
              subject={emailSubject}
              body={content}
              tone={tone}
              onToneChange={setTone}
              onApplySubjectSuggestion={(s) => setEmailSubject(s)}
              onApplyBodyAction={(action) => void handleAiActionSelect(action)}
              isGenerating={isAiGenerating}
            />

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
