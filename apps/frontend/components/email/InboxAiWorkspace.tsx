'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLazyQuery, useQuery } from '@apollo/client';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { GET_SMART_REPLY_SETTINGS } from '@/lib/apollo/queries/smart-reply-settings';
import {
  GENERATE_SMART_REPLY,
  GET_SUGGESTED_REPLIES,
} from '@/lib/apollo/queries/smart-replies';
import { GET_EMAIL_TEMPLATES } from '@/lib/apollo/queries/email-templates';
import type { EmailThread } from '@/lib/email/email-types';
import { InboxAssistantAdapter } from '@/components/email/InboxAssistantAdapter';
import { PriorityBadge, CategoryChip } from '@/components/ui/priority-badge';
import { cn } from '@/lib/utils';

interface InboxAiWorkspaceProps {
  selectedThread: EmailThread | null;
  onUseDraft: (draft: string) => void;
  className?: string;
}

type SmartReplySettingsData = {
  smartReplySettings?: {
    enabled: boolean;
    maxSuggestions: number;
    defaultTone: string;
    defaultLength: string;
  };
};
type SuggestedRepliesData = { getSuggestedReplies: string[] };
type GeneratedReplyData = { generateSmartReply: string };
type EmailTemplatesData = {
  getEmailTemplates: Array<{
    id: string;
    name: string;
    subject: string;
    body: string;
    updatedAt: string;
  }>;
};

const getLastMessageText = (thread: EmailThread | null) => {
  if (!thread || thread.messages.length === 0) return '';
  const last = thread.messages[thread.messages.length - 1];
  return last.content || last.contentPreview || '';
};

const getConversation = (thread: EmailThread | null) => {
  if (!thread || thread.messages.length === 0) return '';
  return thread.messages
    .map((m) => `${m.from?.name || m.from?.email || 'Unknown'}: ${m.content || m.contentPreview || ''}`)
    .join('\n\n');
};

// ─── Collapsible Section Card ────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  badge,
  defaultOpen = true,
  children,
  action,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
  delay?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-primary/80">{icon}</span>
          <span className="text-xs font-semibold">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Smart Reply Bubble ───────────────────────────────────────────────────────

function ReplyBubble({
  text,
  onUse,
}: {
  text: string;
  onUse: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -1, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onUse}
      className="w-full rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:bg-primary/10 hover:border-primary/40"
    >
      {text}
    </motion.button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InboxAiWorkspace({
  selectedThread,
  onUseDraft,
  className,
}: InboxAiWorkspaceProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [generatedReply, setGeneratedReply] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: settingsData } = useQuery<SmartReplySettingsData>(
    GET_SMART_REPLY_SETTINGS,
    { fetchPolicy: 'cache-first' },
  );
  const { data: templateData, loading: templatesLoading } =
    useQuery<EmailTemplatesData>(GET_EMAIL_TEMPLATES, {
      fetchPolicy: 'network-only',
      skip: !showTemplates,
    });

  const [getSuggestedReplies, { loading: suggestionsLoading }] =
    useLazyQuery<SuggestedRepliesData>(GET_SUGGESTED_REPLIES, {
      onCompleted: (data) => setSuggestions(data.getSuggestedReplies ?? []),
      onError: (err) =>
        toast({ title: 'Suggestion failed', description: err.message, variant: 'destructive' }),
    });

  const [generateSmartReply, { loading: generatedLoading }] =
    useLazyQuery<GeneratedReplyData>(GENERATE_SMART_REPLY, {
      onCompleted: (data) => setGeneratedReply(data.generateSmartReply ?? ''),
      onError: (err) =>
        toast({ title: 'Generation failed', description: err.message, variant: 'destructive' }),
    });

  const lastMessageText = useMemo(() => getLastMessageText(selectedThread), [selectedThread]);
  const conversation = useMemo(() => getConversation(selectedThread), [selectedThread]);

  const isSmartReplyEnabled = settingsData?.smartReplySettings?.enabled ?? true;
  const maxSuggestions = settingsData?.smartReplySettings?.maxSuggestions ?? 3;

  const aiPriority = (selectedThread as any)?.aiPriority as string | undefined;
  const aiCategory = (selectedThread as any)?.aiCategory as string | undefined;
  const aiSummary = (selectedThread as any)?.aiSummary as string | undefined;

  const applyDraft = (text: string, source: string) => {
    if (!text) return;
    onUseDraft(text);
    toast({ title: 'Draft prepared', description: `${source} inserted into composer.` });
  };

  const handleGetSuggestions = () => {
    if (!selectedThread || !lastMessageText || !isSmartReplyEnabled) return;
    setGeneratedReply('');
    getSuggestedReplies({ variables: { emailBody: lastMessageText, count: maxSuggestions } });
  };

  const handleGenerateFull = () => {
    if (!selectedThread || !conversation || !isSmartReplyEnabled) return;
    generateSmartReply({
      variables: {
        input: {
          conversation,
          subject: selectedThread.subject,
          tone: settingsData?.smartReplySettings?.defaultTone ?? 'professional',
          length: settingsData?.smartReplySettings?.defaultLength ?? 'medium',
        },
      },
    });
  };

  if (!selectedThread) {
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Workspace</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide ml-auto">
              Active
            </Badge>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center px-6">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select an email thread to activate AI insights
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Workspace</span>
          <div className="ml-auto flex items-center gap-1.5">
            <PriorityBadge priority={aiPriority} showLabel />
            <CategoryChip category={aiCategory} />
          </div>
        </div>
        {selectedThread.subject && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {selectedThread.subject}
          </p>
        )}
      </div>

      {/* Scrollable card area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 px-3 py-3">

          {/* AI Summary card */}
          {aiSummary && (
            <SectionCard
              icon={<Sparkles className="h-3.5 w-3.5" />}
              title="AI Summary"
              delay={0}
            >
              <p className="text-xs leading-relaxed text-muted-foreground">{aiSummary}</p>
            </SectionCard>
          )}

          {/* Smart Replies card */}
          <SectionCard
            icon={<MessageSquarePlus className="h-3.5 w-3.5" />}
            title="Smart Replies"
            delay={0.05}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-primary hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGetSuggestions();
                }}
                disabled={suggestionsLoading || !isSmartReplyEnabled}
              >
                {suggestionsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
              </Button>
            }
          >
            <div className="space-y-1.5 mt-1">
              {suggestionsLoading ? (
                <>
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-4/5 rounded-lg" />
                </>
              ) : suggestions.length > 0 ? (
                suggestions.map((s, i) => (
                  <ReplyBubble
                    key={i}
                    text={s}
                    onUse={() => applyDraft(s, 'Smart suggestion')}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-1">
                  Click ⚡ to generate reply suggestions for this thread.
                </p>
              )}
            </div>
          </SectionCard>

          {/* Full Reply card */}
          <SectionCard
            icon={<WandSparkles className="h-3.5 w-3.5" />}
            title="AI Draft Reply"
            delay={0.1}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-primary hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateFull();
                }}
                disabled={generatedLoading || !isSmartReplyEnabled}
              >
                {generatedLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Generate'
                )}
              </Button>
            }
          >
            {generatedLoading ? (
              <div className="space-y-1.5 mt-1">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>
            ) : generatedReply ? (
              <div className="mt-1 space-y-2">
                <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                  {generatedReply}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={() => applyDraft(generatedReply, 'AI draft')}
                >
                  Use this draft
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-1">
                Click &ldquo;Generate&rdquo; for a context-aware full reply draft.
              </p>
            )}
          </SectionCard>

          {/* Templates card */}
          <SectionCard
            icon={<FileText className="h-3.5 w-3.5" />}
            title="Templates"
            defaultOpen={false}
            delay={0.15}
            action={
              !showTemplates ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTemplates(true);
                  }}
                >
                  Load
                </Button>
              ) : undefined
            }
          >
            {!showTemplates ? (
              <p className="text-xs text-muted-foreground py-1">
                Click &ldquo;Load&rdquo; to browse your email templates.
              </p>
            ) : templatesLoading ? (
              <div className="space-y-1.5 mt-1">
                <Skeleton className="h-8 w-full rounded" />
                <Skeleton className="h-8 w-full rounded" />
              </div>
            ) : (templateData?.getEmailTemplates ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">
                No templates found. Create one in Settings.
              </p>
            ) : (
              <div className="mt-1 space-y-1.5">
                {(templateData?.getEmailTemplates ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.body}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] shrink-0"
                      onClick={() => applyDraft(t.body, 'template')}
                    >
                      Use
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Ask AI card */}
          <SectionCard
            icon={<Bot className="h-3.5 w-3.5" />}
            title="Ask AI"
            defaultOpen={false}
            delay={0.2}
          >
            <div className="mt-1">
              <InboxAssistantAdapter
                selectedThread={selectedThread}
                onUseDraft={onUseDraft}
              />
            </div>
          </SectionCard>
        </div>
      </ScrollArea>
    </div>
  );
}
