import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EmailParticipant, EmailThread } from '@/lib/email/email-types';
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
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
} from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { SEND_EMAIL } from '@/lib/apollo/queries/emails';
import { GET_PROVIDERS } from '@/lib/apollo/queries/providers';
import { useToast } from '@/components/ui/use-toast';
import { EmailAttachmentList } from './EmailAttachment';
import { SmartReplySelector } from './SmartReplySelector';
import { ComposeCopilot } from './ComposeCopilot';
import { getUserData } from '@/lib/auth/auth-utils';
import { cn } from '@/lib/utils';

// ── Recipient chip input ──────────────────────────────────────────────────────

function parseEmailFromRaw(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match ? match[1] : trimmed).trim();
}

const CHIP_COLORS = [
  'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40',
  'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700/40',
  'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40',
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40',
  'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/40',
];

interface RecipientChipInputProps {
  label: string;
  chips: string[];
  onChipsChange: (chips: string[]) => void;
  placeholder?: string;
  onHide?: () => void;
  autoFocus?: boolean;
}

function RecipientChipInput({
  label,
  chips,
  onChipsChange,
  placeholder = 'Add recipients…',
  onHide,
  autoFocus,
}: RecipientChipInputProps) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const email = parseEmailFromRaw(raw);
    if (email && !chips.includes(email)) {
      onChipsChange([...chips, email]);
    }
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      e.preventDefault();
      if (inputVal.trim()) commit(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && chips.length > 0) {
      onChipsChange(chips.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (inputVal.trim()) commit(inputVal);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const emails = pasted.split(/[,;\s]+/).map(parseEmailFromRaw).filter(Boolean);
    if (emails.length > 1) {
      e.preventDefault();
      const merged = [...chips, ...emails.filter(em => !chips.includes(em))];
      onChipsChange(merged);
      setInputVal('');
    }
  };

  return (
    <div
      className="group flex items-start gap-0 border-b border-border/40 last:border-0 px-5 py-1.5 transition-colors hover:bg-muted/20 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-2 select-none">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5 min-h-[36px] py-1">
        <AnimatePresence initial={false}>
          {chips.map((chip, i) => (
            <motion.span
              key={chip}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                CHIP_COLORS[i % CHIP_COLORS.length],
              )}
            >
              <span className="h-3.5 w-3.5 rounded-full bg-current/20 text-[8px] flex items-center justify-center font-bold shrink-0">
                {chip.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[160px] truncate">{chip}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChipsChange(chips.filter((_, idx) => idx !== i)); }}
                className="ml-0.5 rounded-full opacity-50 hover:opacity-100 transition-opacity"
                aria-label={`Remove ${chip}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={chips.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 text-foreground"
        />
      </div>
      {onHide && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onHide(); }}
          className="shrink-0 mt-2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label={`Hide ${label} field`}
        >
          <MinusCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

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

  const [toChips, setToChips] = useState<string[]>(
    mode === 'reply' ? threadRecipients.map(r => r.email) : [],
  );
  const [ccChips, setCcChips] = useState<string[]>([]);
  const [bccChips, setBccChips] = useState<string[]>([]);
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

    setToChips(mode === 'reply' ? threadRecipients.map((recipient) => recipient.email) : []);
    setCcChips([]);
    setBccChips([]);
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
    const toRecipients = toChips;
    const ccRecipients = ccChips;
    const bccRecipients = bccChips;

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
        className="p-0 overflow-hidden sm:max-w-[900px] max-h-[92vh] bg-background/80 backdrop-blur-2xl border-border/50 shadow-2xl"
        style={{ borderRadius: '1rem' }}
      >
        <div className="flex flex-col max-h-[92vh]">
          {/* Composer header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-background/60 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 44%))', boxShadow: '0 2px 10px hsl(262 83% 58% / 0.3)' }}
              >
                <PenLine className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight leading-tight">
                  {composerTitle}
                </h2>
                <p className="text-[11px] text-muted-foreground/70 truncate">
                  {fromAddress ? `from ${fromAddress}` : ''}
                  {isScheduled ? ' · Scheduled' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
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
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label="Close composer">
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
          <div className="flex-1 overflow-auto min-h-[420px]">
          {/* Recipients — chip inputs */}
          <div className="border-b border-border/30">
            {/* To field */}
            <div className="relative">
              <RecipientChipInput
                label="To"
                chips={toChips}
                onChipsChange={setToChips}
                placeholder="Add recipients…"
                autoFocus={mode === 'new'}
              />
              {!showCc && !showBcc && (
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  onClick={() => { setShowCc(true); setShowBcc(true); }}
                >
                  Cc/Bcc
                </button>
              )}
            </div>

            {/* Cc */}
            <AnimatePresence>
              {showCc && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <RecipientChipInput
                    label="Cc"
                    chips={ccChips}
                    onChipsChange={setCcChips}
                    placeholder="Add CC recipients…"
                    onHide={() => setShowCc(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bcc */}
            <AnimatePresence>
              {showBcc && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <RecipientChipInput
                    label="Bcc"
                    chips={bccChips}
                    onChipsChange={setBccChips}
                    placeholder="Add BCC recipients…"
                    onHide={() => setShowBcc(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subject */}
            <div className="flex items-center gap-0 border-b border-border/30 px-5 py-2 hover:bg-muted/20 transition-colors">
              <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide select-none">
                Subject
              </span>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject…"
                className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/40 text-foreground py-1.5"
              />
            </div>

            {/* Subject AI suggestions */}
            <AnimatePresence>
              {SUBJECT_SUGGESTIONS.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 flex-wrap px-5 py-2 bg-muted/20">
                    <Sparkles className="h-3 w-3 text-primary/60 shrink-0" />
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

          {/* Content editor — always-visible toolbar */}
          <div className="flex flex-col flex-1 min-h-0 px-5 pt-3 pb-1">
            {/* Formatting toolbar */}
            <div className="flex items-center gap-0.5 mb-2 pb-2 border-b border-border/30">
              <button
                type="button"
                title="Bold"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Italic"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Underline"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Underline className="h-3.5 w-3.5" />
              </button>
              <div className="h-4 w-px bg-border/60 mx-1" />
              <button
                type="button"
                title="Bullet list"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Numbered list"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Insert link"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </button>
              <div className="h-4 w-px bg-border/60 mx-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <AlignLeft className="h-3 w-3" />
                    <span>Normal</span>
                    <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Normal text</DropdownMenuItem>
                  <DropdownMenuItem className="font-bold">Heading 1</DropdownMenuItem>
                  <DropdownMenuItem className="text-sm font-semibold">Heading 2</DropdownMenuItem>
                  <DropdownMenuItem className="text-sm">Heading 3</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex-1" />
              <button
                type="button"
                title="Emoji"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              <span className="ml-2 text-[10px] text-muted-foreground/40 select-none pr-1">
                type <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">//</kbd> for AI
              </span>
            </div>

            {/* Body textarea */}
            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  const val = e.target.value;
                  setContent(val);
                  if (val.endsWith('//')) setShowAiMenu(true);
                  else setShowAiMenu(false);
                }}
                placeholder="Write your message here…"
                className="min-h-[220px] w-full border-0 shadow-none focus-visible:ring-0 resize-none bg-transparent text-sm leading-relaxed p-0"
              />
              {/* AI floating action menu */}
              <AnimatePresence>
                {showAiMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.14 }}
                    className="absolute left-0 bottom-2 z-50 w-60 rounded-xl border border-border/60 bg-popover/95 shadow-2xl backdrop-blur-xl overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-gradient-to-r from-primary/10 to-transparent">
                      <WandSparkles className="h-3.5 w-3.5 text-primary" />
                      <p className="text-[11px] font-semibold text-foreground">AI actions</p>
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
                    <div className="px-3 py-1.5 border-t bg-muted/20">
                      <button
                        type="button"
                        onClick={() => setShowAiMenu(false)}
                        className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground"
                      >
                        Esc to dismiss
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
        <div className="px-5 py-3.5 border-t flex items-center justify-between bg-background/60 backdrop-blur-md gap-3">
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
