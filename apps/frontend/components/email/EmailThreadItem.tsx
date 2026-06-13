import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Clock, Paperclip, Reply, Star, StarOff } from 'lucide-react';
import { EmailThread, EmailLabel } from '@/lib/email/email-types';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { PriorityStrip, PriorityBadge, CategoryChip } from '@/components/ui/priority-badge';
import { cn } from '@/lib/tokens/cn';

// ─── AI label helpers ────────────────────────────────────────────────────────

type AiPriority = 'high' | 'medium' | 'low';
type AiClassification =
  | 'urgent_issue'
  | 'coordination'
  | 'commercial'
  | 'status_tracking'
  | 'support'
  | 'general';

interface AiMetadata {
  priority: AiPriority | null;
  classification: AiClassification | null;
}

function extractAiMetadata(labelIds: string[] | null | undefined): AiMetadata {
  const labels = labelIds ?? [];
  let priority: AiPriority | null = null;
  let classification: AiClassification | null = null;

  for (const label of labels) {
    if (label === 'ai:priority_high') priority = 'high';
    else if (label === 'ai:priority_medium') priority = 'medium';
    else if (label === 'ai:priority_low') priority = 'low';
    else if (label.startsWith('ai:') && !label.startsWith('ai:priority_')) {
      const cls = label.slice(3) as AiClassification;
      const valid: AiClassification[] = [
        'urgent_issue', 'coordination', 'commercial',
        'status_tracking', 'support', 'general',
      ];
      if (valid.includes(cls)) classification = cls;
    }
  }

  return { priority, classification };
}

const PRIORITY_CONFIG: Record<AiPriority, { label: string; dotClass: string; badgeStyle: React.CSSProperties }> = {
  high: {
    label: 'High',
    dotClass: 'bg-red-500',
    badgeStyle: { backgroundColor: '#ef444420', color: '#ef4444', borderColor: '#ef444440' },
  },
  medium: {
    label: 'Medium',
    dotClass: 'bg-amber-500',
    badgeStyle: { backgroundColor: '#f59e0b20', color: '#f59e0b', borderColor: '#f59e0b40' },
  },
  low: {
    label: 'Low',
    dotClass: 'bg-emerald-500',
    badgeStyle: { backgroundColor: '#10b98120', color: '#10b981', borderColor: '#10b98140' },
  },
};

const CLASSIFICATION_LABELS: Record<AiClassification, string> = {
  urgent_issue: 'Urgent',
  coordination: 'Coordination',
  commercial: 'Commercial',
  status_tracking: 'Status',
  support: 'Support',
  general: 'General',
};

interface EmailThreadItemProps {
  thread: EmailThread;
  isSelected: boolean;
  onSelect: (_thread: EmailThread) => void;
  onToggleStar: (_threadId: string, _isStarred: boolean) => void;
  onArchive?: (_threadId: string) => void;
  onReply?: (_thread: EmailThread) => void;
  availableLabels: EmailLabel[];
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
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

function formatDate(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return minutes <= 1 ? '~1 min read' : `~${minutes} min read`;
}

export function EmailThreadItem({
  thread,
  isSelected,
  onSelect,
  onToggleStar,
  onArchive,
  onReply,
  availableLabels,
  className = '',
}: EmailThreadItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const lastMessage = thread.messages[thread.messages.length - 1];
  const isStarred = lastMessage.isStarred;
  const hasAttachments = lastMessage.attachments.length > 0;
  const fromName = lastMessage.from.name;
  const fromEmail = lastMessage.from.email ?? '';

  // AI metadata (populated after Phase 5 migration)
  const aiPriority = thread.aiPriority;
  const aiCategory = thread.aiCategory;

  const threadLabels = thread.labelIds
    ? (thread.labelIds
        .map((id) => availableLabels.find((l) => l.id === id))
        .filter(Boolean) as EmailLabel[])
    : [];

  const readTime = estimateReadTime(lastMessage.contentPreview ?? '');

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onArchive) return;
    setIsExiting(true);
    setTimeout(() => onArchive(thread.id), 220);
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply?.(thread);
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          layout
          initial={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          whileHover={{ y: -1, transition: { duration: 0.15 } }}
          onClick={() => onSelect(thread)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'group relative cursor-pointer rounded-lg border transition-all duration-150',
            thread.isUnread
              ? 'border-primary/20 bg-primary/5'
              : 'border-border bg-card hover:bg-accent/40',
            isSelected ? 'ring-2 ring-primary border-transparent' : '',
            'pl-3 pr-3 py-3',
            className,
          )}
        >
          {/* AI Priority strip — left edge */}
          <PriorityStrip priority={aiPriority} />

          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="shrink-0 pt-0.5">
              <Avatar className="h-9 w-9">
                <AvatarImage src={lastMessage.from.avatar} alt={fromName} />
                <AvatarFallback
                  className={cn('text-white text-xs', deterministicColor(fromEmail || fromName))}
                >
                  {getInitials(fromName)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Row 1: sender + time */}
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={cn(
                    'text-sm truncate',
                    thread.isUnread ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {fromName}
                  {thread.participants.length > 1 && (
                    <span className="text-muted-foreground font-normal text-xs ml-1">
                      &amp; {thread.participants.length - 1} other
                      {thread.participants.length > 2 ? 's' : ''}
                    </span>
                  )}
                </h4>

                {/* Time + hover quick actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 6 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {onArchive && (
                          <IconButton
                            icon={<Archive className="h-3.5 w-3.5" />}
                            tooltip="Archive"
                            onClick={handleArchive}
                          />
                        )}
                        {onReply && (
                          <IconButton
                            icon={<Reply className="h-3.5 w-3.5" />}
                            tooltip="Quick reply"
                            onClick={handleReply}
                          />
                        )}
                        <IconButton
                          icon={<Clock className="h-3.5 w-3.5" />}
                          tooltip="Snooze"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(lastMessage.date)}
                  </span>
                </div>
              </div>

              {/* Row 2: subject + badges */}
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <h3
                  className={cn(
                    'text-sm truncate',
                    thread.isUnread ? 'font-medium' : 'text-muted-foreground',
                  )}
                >
                  {thread.subject}
                </h3>
                <PriorityBadge priority={aiPriority} showLabel />
                <CategoryChip category={aiCategory} />
              </div>

              {/* Row 3: preview + read time */}
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground truncate flex-1">
                  {lastMessage.contentPreview}
                </p>
                <span className="ml-2 shrink-0 text-[10px] text-muted-foreground/60 italic">
                  {readTime}
                </span>
              </div>

              {/* Row 4: labels + attachments + unread dot */}
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(thread.id, !isStarred);
                    }}
                    className="text-muted-foreground hover:text-yellow-400 transition-colors"
                    aria-label={isStarred ? 'Unstar' : 'Star'}
                  >
                    {isStarred ? (
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {hasAttachments && (
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  )}

                  {threadLabels.slice(0, 2).map((label) => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      style={{
                        backgroundColor: `${label.color}20`,
                        color: label.color,
                        borderColor: `${label.color}40`,
                      }}
                      className="px-1.5 py-0 h-4 text-[9px]"
                    >
                      {label.name}
                    </Badge>
                  ))}
                  {threadLabels.length > 2 && (
                    <Badge variant="outline" className="px-1.5 py-0 h-4 text-[9px]">
                      +{threadLabels.length - 2}
                    </Badge>
                  )}
                </div>

                {thread.isUnread && (
                  <div
                    className="h-2 w-2 rounded-full bg-primary shrink-0"
                    aria-label="Unread"
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
