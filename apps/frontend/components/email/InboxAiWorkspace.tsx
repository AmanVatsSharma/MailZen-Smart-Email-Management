'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import DOMPurify from 'dompurify';
import {
  AlertCircle,
  Bot,
  Brain,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Tag,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { GET_SMART_REPLY_SETTINGS } from '@/lib/apollo/queries/smart-reply-settings';
import {
  GENERATE_SMART_REPLY,
  GET_SUGGESTED_REPLIES,
} from '@/lib/apollo/queries/smart-replies';
import { GET_EMAIL_TEMPLATES, RENDER_EMAIL_TEMPLATE } from '@/lib/apollo/queries/email-templates';
import { GET_THREAD_INSIGHTS } from '@/lib/apollo/queries/agent-assistant';
import { RECORD_AI_FEEDBACK } from '@/lib/apollo/queries/ai-feedback';
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

type ThreadInsightsData = {
  threadInsights: {
    threadId: string;
    summary?: string | null;
    classification?: {
      label: string;
      confidence: number;
      message: string;
    } | null;
    priority?: {
      level: string;
      score: number;
      message: string;
    } | null;
    actionItems: string[];
    generatedAt: string;
  };
};

const getConversation = (thread: EmailThread | null) => {
  if (!thread || thread.messages.length === 0) return '';
  return thread.messages
    .map((m) => `${m.from?.name || m.from?.email || 'Unknown'}: ${m.content || m.contentPreview || ''}`)
    .join('\n\n');
};

/** Returns days since the most recent message in the thread. */
const daysSinceLastMessage = (thread: EmailThread | null): number => {
  if (!thread || thread.messages.length === 0) return 0;
  const last = thread.messages[thread.messages.length - 1];
  const dateVal = (last as any).receivedAt || (last as any).createdAt;
  if (!dateVal) return 0;
  const diff = Date.now() - new Date(dateVal as string).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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

// ─── Follow-up Banner ────────────────────────────────────────────────────────

function FollowUpBanner({ days }: { days: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
    >
      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          Follow-up reminder
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          No reply in this thread for {days} day{days !== 1 ? 's' : ''}. Consider sending a follow-up.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground/50 hover:text-muted-foreground text-xs leading-none shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </motion.div>
  );
}

// ─── Triage Action Suggestions ────────────────────────────────────────────────

function TriageActions({
  priority,
  category,
}: {
  priority?: string;
  category?: string;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dismiss = (key: string) => setDismissed((prev) => new Set(prev).add(key));

  const actions: { key: string; label: string; icon: string }[] = [];

  if (
    category?.toLowerCase() === 'newsletter' ||
    category?.toLowerCase() === 'promo'
  ) {
    actions.push({ key: 'unsub', label: 'Unsubscribe from sender', icon: '🚫' });
  }
  if (priority?.toUpperCase() === 'URGENT' || priority?.toUpperCase() === 'HIGH') {
    actions.push({ key: 'important', label: 'Mark as important', icon: '⭐' });
  }
  if (category) {
    actions.push({ key: 'label', label: `Apply label: ${category}`, icon: '🏷️' });
  }

  const visible = actions.filter((a) => !dismissed.has(a.key));
  if (visible.length === 0) return null;

  return (
    <SectionCard
      icon={<AlertCircle className="h-3.5 w-3.5" />}
      title="Suggested Actions"
      delay={0.03}
    >
      <div className="mt-1 space-y-1.5">
        {visible.map((action) => (
          <div
            key={action.key}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-2.5 py-1.5"
          >
            <span className="text-xs">
              {action.icon} {action.label}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-5 px-2 text-[10px]"
                onClick={() => dismiss(action.key)}
              >
                Apply
              </Button>
              <button
                onClick={() => dismiss(action.key)}
                className="text-muted-foreground/50 hover:text-muted-foreground text-xs"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InboxAiWorkspace({
  selectedThread,
  onUseDraft,
  className,
}: InboxAiWorkspaceProps) {
  const { toast } = useToast();
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [templatePreviewTitle, setTemplatePreviewTitle] = useState('');
  const [templatePreviewHtml, setTemplatePreviewHtml] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [generatedReply, setGeneratedReply] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState('reply');

  const { data: settingsData } = useQuery<SmartReplySettingsData>(
    GET_SMART_REPLY_SETTINGS,
    { fetchPolicy: 'cache-first' },
  );
  const { data: templateData, loading: templatesLoading } =
    useQuery<EmailTemplatesData>(GET_EMAIL_TEMPLATES, {
      fetchPolicy: 'network-only',
      skip: !showTemplates,
    });

  const [renderTemplatePreview, { loading: templatePreviewLoading }] = useLazyQuery(
    RENDER_EMAIL_TEMPLATE,
    { fetchPolicy: 'network-only' },
  );

  const handlePreviewTemplate = async (template: { id: string; name: string }) => {
    setTemplatePreviewTitle(template.name);
    setTemplatePreviewOpen(true);
    setTemplatePreviewHtml('');
    try {
      const { data, error } = await renderTemplatePreview({
        variables: { id: template.id, variables: '{}' },
      });
      if (error) throw error;
      const raw = data?.renderEmailTemplate ?? '';
      setTemplatePreviewHtml(DOMPurify.sanitize(raw));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Preview failed';
      toast({ title: 'Template preview failed', description: message, variant: 'destructive' });
      setTemplatePreviewOpen(false);
    }
  };

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

  const [recordFeedback] = useMutation(RECORD_AI_FEEDBACK);
  const [getThreadInsights, { data: insightsData, loading: insightsLoading, error: insightsError }] =
    useLazyQuery<ThreadInsightsData>(GET_THREAD_INSIGHTS, {
      fetchPolicy: 'network-only',
      onError: (error) => {
        toast({
          title: 'Insights generation failed',
          description: error.message,
          variant: 'destructive',
        });
      },
    });

  const lastMessageText = useMemo(() => getLastMessageText(selectedThread), [selectedThread]);
  const conversation = useMemo(() => getConversation(selectedThread), [selectedThread]);
  const staleDays = useMemo(() => daysSinceLastMessage(selectedThread), [selectedThread]);

  const isSmartReplyEnabled = settingsData?.smartReplySettings?.enabled ?? true;
  const maxSuggestions = settingsData?.smartReplySettings?.maxSuggestions ?? 3;

  const aiPriority = (selectedThread as any)?.aiPriority as string | undefined;
  const aiCategory = (selectedThread as any)?.aiCategory as string | undefined;
  const aiSummary = (selectedThread as any)?.aiSummary as string | undefined;

  const applyDraft = (text: string, source: string, skill = 'inbox') => {
    if (!text) return;
    onUseDraft(text);
    toast({ title: 'Draft prepared', description: `${source} inserted into composer.` });
    // Phase 7: record positive feedback signal
    recordFeedback({
      variables: {
        input: {
          agentSkill: skill,
          action: 'use_draft',
          signal: 'accept',
          emailId: selectedThread?.id ?? null,
          draftText: text.slice(0, 500),
        },
      },
    }).catch(() => {/* non-critical */});
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

  const handleLoadInsights = () => {
    if (!selectedThread?.id) return;
    getThreadInsights({ variables: { threadId: selectedThread.id } });
  };

  const insights = insightsData?.threadInsights;

  const priorityColor = (level?: string) => {
    if (level === 'HIGH') return 'text-destructive';
    if (level === 'MEDIUM') return 'text-yellow-500';
    return 'text-green-500';
  };

  const priorityBadgeVariant = (level?: string): 'destructive' | 'outline' | 'secondary' => {
    if (level === 'HIGH') return 'destructive';
    if (level === 'MEDIUM') return 'outline';
    return 'secondary';
  };

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

          {/* Follow-up reminder banner (shown when thread is stale ≥ 3 days) */}
          {staleDays >= 3 && <FollowUpBanner days={staleDays} />}

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

          {/* Triage action suggestions */}
          <TriageActions priority={aiPriority} category={aiCategory} />

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
                    onUse={() => applyDraft(s, 'Smart suggestion', 'inbox')}
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
                  onClick={() => applyDraft(generatedReply, 'AI draft', 'inbox')}
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
                      onClick={() => applyDraft(t.body, 'template', 'inbox')}
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

      <Dialog open={templatePreviewOpen} onOpenChange={setTemplatePreviewOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Preview: {templatePreviewTitle}</DialogTitle>
          </DialogHeader>
          {templatePreviewLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Rendering template…
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] rounded-md border border-border/60 p-3">
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: templatePreviewHtml || '<p class="text-muted-foreground">(empty)</p>' }}
              />
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
