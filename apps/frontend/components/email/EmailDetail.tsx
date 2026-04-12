'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Trash2,
  Archive,
  Reply,
  Forward,
  MoreHorizontal,
  Star,
  Mail,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  Paperclip,
  Send,
  X,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EmailThread, EmailLabel, EmailMessage } from '@/lib/email/email-types';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { GET_EMAIL, UPDATE_EMAIL } from '@/lib/apollo/queries/emails';
import DOMPurify from 'dompurify';
import { EmailAttachmentList } from './EmailAttachment';
import { AvatarGroup } from '@/components/ui/avatar-group';
import { PriorityBadge, CategoryChip } from '@/components/ui/priority-badge';

const GET_SENDER_PROFILE = gql`
  query GetSenderProfile($email: String!) {
    senderProfile(email: $email) {
      id
      senderEmail
      displayName
      relationshipScore
      isVip
      emailCount
      topics
    }
  }
`;

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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function deterministicColor(str: string): string {
  const palette = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-cyan-500',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

// ─── Collapsible message card ────────────────────────────────────────────────

function MessageCard({
  message,
  index,
  total,
  defaultExpanded,
  contentRef,
  sanitize,
}: {
  message: EmailMessage;
  index: number;
  total: number;
  defaultExpanded: boolean;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  sanitize: (html: string) => string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isLast = index === total - 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className={cn(
        'rounded-xl border overflow-hidden transition-shadow',
        isLast
          ? 'border-primary/20 bg-card shadow-sm'
          : 'border-border/60 bg-card/60',
      )}
    >
      {/* Message header — always visible */}
      <button
        type="button"
        onClick={() => !isLast && setExpanded((p) => !p)}
        className={cn(
          'flex w-full items-start justify-between gap-3 p-4 text-left transition-colors',
          !isLast && 'hover:bg-muted/30',
          isLast && 'cursor-default',
        )}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={message.from.avatar} alt={message.from.name} />
            <AvatarFallback
              className={cn(
                'text-white text-xs',
                deterministicColor(message.from.email ?? message.from.name),
              )}
            >
              {getInitials(message.from.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{message.from.name}</p>
            <p className="text-xs text-muted-foreground truncate">{message.from.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs text-muted-foreground"
            title={new Date(message.date).toLocaleString()}
          >
            {formatDistanceToNow(new Date(message.date), { addSuffix: true })}
          </span>
          {!isLast && (
            expanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Collapsed preview (non-last messages) */}
      <AnimatePresence initial={false}>
        {!expanded && !isLast && (
          <motion.p
            key="preview"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden px-4 pb-3 text-xs text-muted-foreground truncate"
          >
            {message.contentPreview}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Full content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {/* Recipients row */}
            <div className="px-4 pb-2 text-xs text-muted-foreground border-t border-border/40 pt-2">
              <span className="font-medium">To: </span>
              {message.to.map((r) => r.name || r.email).join(', ')}
              {message.cc && message.cc.length > 0 && (
                <>
                  {'  ·  '}
                  <span className="font-medium">Cc: </span>
                  {message.cc.map((r) => r.name || r.email).join(', ')}
                </>
              )}
            </div>

            {/* Body */}
            <div
              ref={isLast ? contentRef : undefined}
              className="px-4 pb-4 prose prose-sm max-w-none dark:prose-invert overflow-auto"
              dangerouslySetInnerHTML={{ __html: sanitize(message.content) }}
            />

            {/* Attachments */}
            {message.attachments.length > 0 && (
              <div className="border-t border-border/40 p-4">
                <p className="text-xs font-medium mb-2 flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attachments ({message.attachments.length})
                </p>
                <EmailAttachmentList
                  attachments={message.attachments}
                  canDownload
                  showPreview
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Inline reply box ────────────────────────────────────────────────────────

function InlineReplyBox({ onSend }: { onSend: (text: string) => void }) {
  const [focused, setFocused] = useState(false);
  const [value, setValue] = useState('');

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue('');
    setFocused(false);
  };

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        focused
          ? 'border-primary/40 shadow-md bg-card'
          : 'border-border/50 bg-muted/30',
      )}
    >
      {!focused ? (
        <button
          type="button"
          onClick={() => setFocused(true)}
          className="w-full px-4 py-3 text-sm text-muted-foreground text-left"
        >
          Reply to this thread...
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <Textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Write your reply..."
            className="min-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 rounded-t-xl"
          />
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-7"
              onClick={() => { setValue(''); setFocused(false); }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSend}
              disabled={!value.trim()}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Send
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

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
  const { data: emailData, loading: emailLoading } = useQuery(GET_EMAIL, {
    variables: { id: thread?.id },
    skip: !thread?.id,
    fetchPolicy: 'network-only',
  });
  void emailLoading;

  // Fetch sender profile for VIP / relationship score display
  const senderEmail = thread?.messages?.[thread.messages.length - 1]?.from?.email ?? '';
  const { data: senderData } = useQuery<{
    senderProfile: {
      id: string;
      senderEmail: string;
      displayName?: string;
      relationshipScore: number;
      isVip: boolean;
      emailCount: number;
      topics: string[];
    } | null;
  }>(GET_SENDER_PROFILE, {
    variables: { email: senderEmail },
    skip: !senderEmail,
    fetchPolicy: 'cache-first',
  });
  const senderProfile = senderData?.senderProfile;

  const effectiveThread = (emailData?.email as EmailThread | undefined) || thread;
  const effectiveThreadId = effectiveThread?.id;
  const effectiveIsUnread = !!effectiveThread?.isUnread;

  const [updateEmail] = useMutation(UPDATE_EMAIL);
  const emailContentRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);
  const [showJumpToUnread, setShowJumpToUnread] = useState(false);

  // Mark as read on open
  useEffect(() => {
    if (effectiveThreadId && effectiveIsUnread) {
      updateEmail({
        variables: { id: effectiveThreadId, input: { read: true } },
      }).catch(() => {});
    }
  }, [effectiveThreadId, effectiveIsUnread, updateEmail]);

  // Show jump-to-unread pill when thread has unread messages not in view
  useEffect(() => {
    if (!effectiveThread) return;
    const hasUnread = effectiveThread.messages.some((m) => !(m as any).isRead);
    setShowJumpToUnread(hasUnread && (effectiveThread.messages.length ?? 0) > 3);
  }, [effectiveThread]);

  // Make links safe
  useEffect(() => {
    const links = emailContentRef.current?.querySelectorAll('a');
    links?.forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
    emailContentRef.current?.querySelectorAll('img')?.forEach((img) => {
      img.classList.add('max-w-full', 'h-auto');
    });
  }, [effectiveThread]);

  const sanitize = (html: string) =>
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3',
        'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'div', 'span', 'hr', 'img',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style', 'class', 'target', 'rel', 'width', 'height', 'align'],
    });

  if (!effectiveThread) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-center p-8', className)}>
        <div className="p-6 rounded-full bg-primary/10 mb-4">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-medium mb-2">No email selected</h3>
        <p className="text-muted-foreground">Select an email from the list to view its content</p>
      </div>
    );
  }

  const lastMessage = effectiveThread.messages[effectiveThread.messages.length - 1];
  const isStarred = lastMessage.isStarred;
  const aiPriority = (effectiveThread as any).aiPriority as string | undefined;
  const aiCategory = (effectiveThread as any).aiCategory as string | undefined;
  const aiSummary = (effectiveThread as any).aiSummary as string | undefined;
  const isMultiMessage = effectiveThread.messages.length > 1;

  const threadLabels = effectiveThread.labelIds
    ? (effectiveThread.labelIds
        .map((id) => availableLabels.find((l) => l.id === id))
        .filter(Boolean) as EmailLabel[])
    : [];

  const participants = effectiveThread.participants ?? effectiveThread.messages.map((m) => m.from);

  const handleToggleStar = () => {
    updateEmail({
      variables: { id: effectiveThread.id, input: { starred: !isStarred } },
    })
      .then(() => onToggleStar(effectiveThread.id, !isStarred))
      .catch(() => {});
  };

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onBackToPreview && (
            <Button variant="ghost" size="sm" onClick={onBackToPreview} className="shrink-0 mr-1">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <h2 className="text-base font-semibold truncate">{effectiveThread.subject}</h2>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => onReply(effectiveThread.id)} aria-label="Reply">
            <Reply className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onForward(effectiveThread.id)} aria-label="Forward">
            <Forward className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onArchive(effectiveThread.id)} aria-label="Archive">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(effectiveThread.id)} aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleStar}
            aria-label={isStarred ? 'Unstar' : 'Star'}
            className={isStarred ? 'text-yellow-400' : ''}
          >
            <Star className={cn('h-4 w-4', isStarred && 'fill-yellow-400')} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

      {/* ── Meta row: participants + badges ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
        <AvatarGroup
          participants={participants.map((p) => ({ name: p.name, email: p.email ?? '', avatar: p.avatar }))}
          size="sm"
          maxVisible={4}
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* VIP sender badge */}
          {senderProfile?.isVip && (
            <span
              title={`VIP Sender — relationship score ${senderProfile.relationshipScore.toFixed(2)}`}
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-400/30"
            >
              <Crown className="h-2.5 w-2.5" />
              VIP
            </span>
          )}
          {/* High relationship score (not yet manually flagged) */}
          {!senderProfile?.isVip && (senderProfile?.relationshipScore ?? 0) >= 0.8 && (
            <span
              title={`Frequent contact — relationship score ${senderProfile!.relationshipScore.toFixed(2)}`}
              className="inline-flex items-center gap-0.5 rounded-full bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-500 border border-violet-400/20"
            >
              <Crown className="h-2.5 w-2.5" />
              Frequent
            </span>
          )}
          <PriorityBadge priority={aiPriority} showLabel />
          <CategoryChip category={aiCategory} />
          {isMultiMessage && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {effectiveThread.messages.length} messages
            </Badge>
          )}
          {threadLabels.map((label) => (
            <Badge
              key={label.id}
              variant="outline"
              style={{ backgroundColor: `${label.color}20`, color: label.color, borderColor: `${label.color}40` }}
              className="text-[10px] h-5 px-1.5"
            >
              {label.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-4 relative">

        {/* AI Summary card */}
        {aiSummary && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">AI Thread Summary</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{aiSummary}</p>
          </motion.div>
        )}

        {/* Messages */}
        <div className="space-y-3" ref={unreadRef}>
          {effectiveThread.messages.map((message, index) => (
            <MessageCard
              key={message.id}
              message={message}
              index={index}
              total={effectiveThread.messages.length}
              defaultExpanded={
                index === effectiveThread.messages.length - 1 || effectiveThread.messages.length <= 2
              }
              contentRef={index === effectiveThread.messages.length - 1 ? emailContentRef : undefined}
              sanitize={sanitize}
            />
          ))}
        </div>

        {/* Inline reply */}
        <div className="mt-4">
          <InlineReplyBox
            onSend={(text) => {
              void text;
              onReply(effectiveThread.id);
            }}
          />
        </div>
      </div>

      {/* Jump to unread floating pill */}
      <AnimatePresence>
        {showJumpToUnread && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              unreadRef.current?.scrollIntoView({ behavior: 'smooth' });
              setShowJumpToUnread(false);
            }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary shadow-lg backdrop-blur-sm hover:bg-primary/20 transition-colors"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Jump to unread
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
