/**
 * File:        apps/frontend/components/email/EmailComposer.tsx
 * Module:      Email · Composer
 * Purpose:     Full-featured email compose dialog with Tiptap rich text editing,
 *              recipient chip inputs, scheduling, attachments, and AI draft/copilot features.
 *
 * Exports:
 *   - EmailComposer(props) — Dialog-based email compose component
 *   - EmailComposerProps   — prop shape (isOpen, onClose, replyToThread, etc.)
 *
 * Depends on:
 *   - @tiptap/react                           — useEditor for toolbar command access
 *   - @tiptap/starter-kit                     — core extensions (bold, italic, lists, etc.)
 *   - @tiptap/extension-link                  — hyperlink support
 *   - @tiptap/extension-underline             — underline mark
 *   - @tiptap/extension-text-align            — left/center/right/justify alignment
 *   - @tiptap/extension-placeholder           — empty-state placeholder text
 *   - ./RichTextEditor                        — Tiptap EditorContent wrapper + ref handle
 *   - @/lib/apollo/queries/emails             — SEND_EMAIL mutation
 *   - @/lib/apollo/queries/providers          — GET_PROVIDERS query
 *   - @/lib/apollo/queries/agent-assistant    — AGENT_ASSIST_MUTATION for AI draft and inline actions
 *   - @/lib/email/email-types                 — EmailParticipant, EmailThread types
 *   - @/lib/auth/auth-utils                   — getUserData for fallback sender address
 *   - ./ComposeCopilot                        — AI tone picker + body action panel
 *   - ./SmartReplySelector                    — AI-suggested reply chips
 *   - ./EmailAttachment                       — attachment list display
 *
 * Side-effects:
 *   - GraphQL mutation: sendEmail (via Apollo)
 *   - GraphQL mutation: agentAssist (via Apollo) — AI draft generation and inline actions
 *   - GraphQL query:    providers (cache-first, via Apollo)
 *
 * Key invariants:
 *   - The editor instance (useEditor) is created here and passed into RichTextEditor as
 *     a prop. This ensures the toolbar's chain() calls and the visible EditorContent share
 *     one ProseMirror state — no dual-editor disconnection.
 *   - Body content is stored as HTML in `content` state; all AI text operations must
 *     work through the editor instance or convert HTML ↔ text appropriately.
 *   - The `//` AI trigger is detected via Tiptap onUpdate (editor.getText().endsWith('//'))
 *     rather than raw onChange on a textarea.
 *   - ComposeCopilot.body receives plain text (editor.getText()) not HTML.
 *   - Empty-body check uses editor?.isEmpty rather than falsy string check.
 *   - assistantText from agentAssist is plain text; must be converted to paragraph HTML
 *     before setting editor content via editor.commands.setContent().
 *
 * Read order:
 *   1. EmailComposerProps     — component contract
 *   2. RecipientChipInput     — reusable chip input used for To/Cc/Bcc
 *   3. EmailComposer          — main composer implementation
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-19
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
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
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapUnderline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useMutation, useQuery } from '@apollo/client';
import { SEND_EMAIL } from '@/lib/apollo/queries/emails';
import { GET_PROVIDERS } from '@/lib/apollo/queries/providers';
import { AGENT_ASSIST_MUTATION } from '@/lib/apollo/queries/agent-assistant';
import { useToast } from '@/components/ui/use-toast';
import { EmailAttachmentList } from './EmailAttachment';
import { SmartReplySelector } from './SmartReplySelector';
import { ComposeCopilot } from './ComposeCopilot';
import { getUserData } from '@/lib/auth/auth-utils';
import { cn } from '@/lib/utils';
import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor';

// ── Recipient chip input ──────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [invalidInput, setInvalidInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const email = parseEmailFromRaw(raw);
    if (!email) { setInputVal(''); return; }
    if (!EMAIL_REGEX.test(email)) {
      setInvalidInput(true);
      setTimeout(() => setInvalidInput(false), 1500);
      return;
    }
    if (!chips.includes(email)) {
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
          className={cn(
            'flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/40',
            invalidInput ? 'text-destructive' : 'text-foreground',
          )}
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
  const editorRef = useRef<RichTextEditorHandle>(null);

  // ── Tiptap editor instance — owned here, passed into RichTextEditor as a prop ──
  // Single instance shared between toolbar buttons (chain()) and EditorContent.
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapUnderline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Write your message here…' }),
    ],
    editorProps: {
      attributes: {
        // prose classes give proper typography for headings, lists, links, etc.
        class: 'min-h-[220px] w-full focus:outline-none text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none',
      },
    },
    content: '',
    onUpdate({ editor: ed }) {
      const html = ed.getHTML();
      setContent(html);
      // Detect `//` AI trigger via plain text
      if (ed.getText().endsWith('//')) {
        setShowAiMenu(true);
      } else {
        setShowAiMenu(false);
      }
    },
  });

  // Apollo Client mutations — declared before handlers so they are available in callbacks
  const [sendEmail] = useMutation(SEND_EMAIL);
  const [agentAssist] = useMutation(AGENT_ASSIST_MUTATION);

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

      if (!editor) return;

      // Strip the `//` trigger from the plain text end before sending to the AI —
      // the trigger is a UI affordance and should not be included in the prompt context.
      const plainText = editor.getText();
      const stripped = plainText.replace(/\/\/$/, '').trimEnd();

      setIsAiGenerating(true);
      try {
        const result = await agentAssist({
          variables: {
            input: {
              skill: 'compose',
              messages: [{ role: 'user', content: stripped }],
              requestedAction: actionKey,
            },
          },
        });
        const assistantText = result.data?.agentAssist?.assistantText;
        if (assistantText) {
          // Convert plain text paragraphs to HTML — assistantText uses \n\n as paragraph separator
          const newHtml = assistantText
            .split(/\n\n+/)
            .map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('');
          editor.commands.setContent(newHtml, { emitUpdate: false });
          setContent(newHtml);
          toast({ title: 'AI applied', description: 'Content updated.' });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast({ title: 'AI unavailable', description: message, variant: 'destructive' });
      } finally {
        setIsAiGenerating(false);
      }
    },
    [editor, toast, agentAssist],
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
    // Use editor.isEmpty rather than falsy string — Tiptap empty state returns '<p></p>'
    const bodyIsEmpty = editor ? editor.isEmpty : !content;
    if (bodyIsEmpty && !emailSubject) {
      toast({ title: 'Add some context', description: 'Enter a subject or a few words in the body to generate a draft.' });
      return;
    }
    setIsAiGenerating(true);
    try {
      const plainBody = editor ? editor.getText() : content;
      const result = await agentAssist({
        variables: {
          input: {
            skill: 'compose',
            messages: [
              {
                role: 'user',
                content: `Subject: ${emailSubject}\n\nTone: ${tone}\n\nContext: ${plainBody}`,
              },
            ],
          },
        },
      });
      const assistantText = result.data?.agentAssist?.assistantText;
      if (assistantText) {
        // Convert plain text paragraphs to HTML — assistantText uses \n\n as paragraph separator
        const newHtml = assistantText
          .split(/\n\n+/)
          .map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
        if (editor) {
          editor.commands.setContent(newHtml, { emitUpdate: false });
        }
        setContent(newHtml);
        toast({ title: 'Draft ready', description: 'AI draft inserted — edit as needed before sending.' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'AI unavailable', description: message, variant: 'destructive' });
    } finally {
      setIsAiGenerating(false);
    }
  };

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
    // Sync editor when the dialog opens / mode changes
    if (editor) {
      editor.commands.setContent(initialContent || '', { emitUpdate: false });
    }
  }, [editor, initialContent, isOpen, mode, subject, threadRecipients]);

  // Draft auto-save — debounced 3s, localStorage, only in 'new' compose mode
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isOpen || mode !== 'new') return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          'mailzen_draft_compose',
          JSON.stringify({ subject: emailSubject, body: content, to: toChips, cc: ccChips, bcc: bccChips }),
        );
      } catch {}
    }, 3000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [isOpen, mode, emailSubject, content, toChips, ccChips, bccChips]);

  // Restore draft when composer opens in 'new' mode
  useEffect(() => {
    if (!isOpen || mode !== 'new') return;
    try {
      const saved = localStorage.getItem('mailzen_draft_compose');
      if (!saved) return;
      const draft = JSON.parse(saved) as { subject?: string; body?: string; to?: string[]; cc?: string[]; bcc?: string[] };
      if (draft.subject) setEmailSubject(draft.subject);
      if (draft.to?.length) setToChips(draft.to);
      if (draft.cc?.length) setCcChips(draft.cc);
      if (draft.bcc?.length) setBccChips(draft.bcc);
      if (draft.body && editor) editor.commands.setContent(draft.body, { emitUpdate: false });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

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
      // Get final HTML body from the editor (source of truth); fall back to state
      const bodyHtml = editor ? editor.getHTML() : content;

      const attachmentInputs = attachments.length
        ? await Promise.all(
            attachments.map(async (file) => ({
              filename: file.name,
              contentType: file.type || 'application/octet-stream',
              content: await readFileAsBase64(file),
              size: file.size,
            })),
          )
        : undefined;

      await sendEmail({
        variables: {
          input: {
            subject: emailSubject,
            body: bodyHtml,
            from: fromAddress,
            to: toRecipients,
            providerId: activeProvider.id,
            scheduledAt: isScheduled ? scheduledDate?.toISOString() : undefined,
            attachments: attachmentInputs,
          },
        },
      });

      try { localStorage.removeItem('mailzen_draft_compose'); } catch {}

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
                      // Smart reply text is plain — wrap in paragraph HTML for the editor
                      const replyHtml = text
                        .split(/\n\n+/)
                        .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                        .join('');
                      if (editor) {
                        editor.commands.setContent(replyHtml, { emitUpdate: false });
                      }
                      setContent(replyHtml);
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
            {/* Formatting toolbar — wired to Tiptap editor commands */}
            <div className="flex items-center gap-0.5 mb-2 pb-2 border-b border-border/30">
              <button
                type="button"
                title="Bold"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive('bold')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Italic"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive('italic')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Underline"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive('underline')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <UnderlineIcon className="h-3.5 w-3.5" />
              </button>
              <div className="h-4 w-px bg-border/60 mx-1" />
              <button
                type="button"
                title="Bullet list"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive('bulletList')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Numbered list"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive('orderedList')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Insert link"
                onClick={() => {
                  const url = window.prompt('Enter URL');
                  if (url) {
                    editor?.chain().focus().setLink({ href: url }).run();
                  }
                }}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive('link')
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </button>
              <div className="h-4 w-px bg-border/60 mx-1" />
              {/* Text alignment buttons */}
              <button
                type="button"
                title="Align left"
                onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive({ textAlign: 'left' })
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Align center"
                onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive({ textAlign: 'center' })
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Align right"
                onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  editor?.isActive({ textAlign: 'right' })
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <AlignRight className="h-3.5 w-3.5" />
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
                  <DropdownMenuItem onClick={() => editor?.chain().focus().setParagraph().run()}>
                    Normal text
                  </DropdownMenuItem>
                  <DropdownMenuItem className="font-bold" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                    Heading 1
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-sm font-semibold" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                    Heading 2
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-sm" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
                    Heading 3
                  </DropdownMenuItem>
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

            {/* Body — Tiptap rich text editor (editor instance hoisted here so toolbar works) */}
            <div className="relative flex-1">
              <RichTextEditor
                ref={editorRef}
                editor={editor}
                content={content}
                onChange={(html) => setContent(html)}
                className="min-h-[220px]"
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
              body={editor ? editor.getText() : content}
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
