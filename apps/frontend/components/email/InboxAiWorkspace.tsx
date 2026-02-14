'use client';

import React, { useMemo, useState } from 'react';
import { useLazyQuery, useQuery } from '@apollo/client';
import {
  Bot,
  Brain,
  Lightbulb,
  Loader2,
  Sparkles,
  WandSparkles,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { GET_SMART_REPLY_SETTINGS } from '@/lib/apollo/queries/smart-reply-settings';
import {
  GENERATE_SMART_REPLY,
  GET_SUGGESTED_REPLIES,
} from '@/lib/apollo/queries/smart-replies';
import { GET_EMAIL_TEMPLATES } from '@/lib/apollo/queries/email-templates';
import type { EmailThread } from '@/lib/email/email-types';
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

type SuggestedRepliesData = {
  getSuggestedReplies: string[];
};

type GeneratedReplyData = {
  generateSmartReply: string;
};

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
    .map((message) => {
      const from = message.from?.name || message.from?.email || 'Unknown';
      return `${from}: ${message.content || message.contentPreview || ''}`;
    })
    .join('\n\n');
};

export function InboxAiWorkspace({
  selectedThread,
  onUseDraft,
  className,
}: InboxAiWorkspaceProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [generatedReply, setGeneratedReply] = useState('');

  const { data: smartReplySettingsData } = useQuery<SmartReplySettingsData>(
    GET_SMART_REPLY_SETTINGS,
    { fetchPolicy: 'cache-first' },
  );

  const {
    data: templateData,
    loading: templatesLoading,
    error: templatesError,
  } = useQuery<EmailTemplatesData>(GET_EMAIL_TEMPLATES, {
    fetchPolicy: 'network-only',
  });

  const [getSuggestedReplies, { loading: suggestionsLoading }] =
    useLazyQuery<SuggestedRepliesData>(GET_SUGGESTED_REPLIES, {
      onCompleted: (data) => {
        setSuggestions(data.getSuggestedReplies ?? []);
      },
      onError: (error) => {
        toast({
          title: 'Suggestion generation failed',
          description: error.message,
          variant: 'destructive',
        });
      },
    });

  const [generateSmartReply, { loading: generatedLoading }] =
    useLazyQuery<GeneratedReplyData>(GENERATE_SMART_REPLY, {
      onCompleted: (data) => {
        setGeneratedReply(data.generateSmartReply ?? '');
      },
      onError: (error) => {
        toast({
          title: 'Reply generation failed',
          description: error.message,
          variant: 'destructive',
        });
      },
    });

  const lastMessageText = useMemo(
    () => getLastMessageText(selectedThread),
    [selectedThread],
  );
  const conversation = useMemo(
    () => getConversation(selectedThread),
    [selectedThread],
  );

  const maxSuggestions =
    smartReplySettingsData?.smartReplySettings?.maxSuggestions ?? 3;
  const isSmartReplyEnabled =
    smartReplySettingsData?.smartReplySettings?.enabled ?? true;

  const handleGenerateSuggestions = () => {
    if (!selectedThread || !lastMessageText) return;
    if (!isSmartReplyEnabled) {
      toast({
        title: 'Smart replies disabled',
        description: 'Enable Smart Replies in settings to use AI agents.',
        variant: 'destructive',
      });
      return;
    }
    setGeneratedReply('');
    getSuggestedReplies({
      variables: {
        emailBody: lastMessageText,
        count: maxSuggestions,
      },
    });
  };

  const handleGenerateReply = () => {
    if (!selectedThread || !conversation) return;
    if (!isSmartReplyEnabled) {
      toast({
        title: 'Smart replies disabled',
        description: 'Enable Smart Replies in settings to use AI agents.',
        variant: 'destructive',
      });
      return;
    }
    generateSmartReply({
      variables: {
        input: {
          conversation,
        },
      },
    });
  };

  const applyDraft = (text: string, source: string) => {
    if (!text) return;
    onUseDraft(text);
    toast({
      title: 'Draft prepared',
      description: `Inserted ${source} output into a new composer draft.`,
    });
  };

  const threadInsights = useMemo(() => {
    if (!selectedThread) return null;
    return {
      participantCount: selectedThread.participants.length,
      messageCount: selectedThread.messages.length,
      subject: selectedThread.subject,
      lastMessageDate: new Date(selectedThread.lastMessageDate).toLocaleString(),
      hasLabels: selectedThread.labelIds?.length ? 'Yes' : 'No',
    };
  }, [selectedThread]);

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Inbox AI Workspace</p>
          </div>
          <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
            Agents
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Reply, template, and insight agents powered by existing backend features.
        </p>
      </div>

      <div className="min-h-0 flex-1 px-3 py-3">
        <Tabs defaultValue="reply" className="flex h-full min-h-0 flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reply" className="text-xs">
              Reply
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">
              Templates
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs">
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reply" className="mt-3 min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={handleGenerateSuggestions}
                  disabled={!selectedThread || suggestionsLoading}
                >
                  {suggestionsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate suggestions
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={handleGenerateReply}
                  disabled={!selectedThread || generatedLoading}
                >
                  {generatedLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <WandSparkles className="h-4 w-4" />
                  )}
                  Generate full reply
                </Button>
              </div>

              <ScrollArea className="min-h-0 flex-1 rounded-md border border-border/70">
                <div className="space-y-2 p-2">
                  {!selectedThread ? (
                    <p className="p-2 text-xs text-muted-foreground">
                      Select an email thread to activate the reply agent.
                    </p>
                  ) : null}

                  {generatedReply ? (
                    <Card className="space-y-2 border-primary/30 p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="default">Full reply</Badge>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7"
                          onClick={() => applyDraft(generatedReply, 'reply agent')}
                        >
                          Use
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{generatedReply}</p>
                    </Card>
                  ) : null}

                  {suggestions.map((suggestion, index) => (
                    <Card key={`${suggestion}-${index}`} className="space-y-2 p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Suggestion {index + 1}</Badge>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7"
                          onClick={() => applyDraft(suggestion, 'smart suggestion')}
                        >
                          Use
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion}</p>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-full rounded-md border border-border/70">
              <div className="space-y-2 p-2">
                {templatesLoading ? (
                  <p className="p-2 text-xs text-muted-foreground">Loading templates...</p>
                ) : null}
                {templatesError ? (
                  <p className="p-2 text-xs text-muted-foreground">
                    Template agent unavailable with current schema.
                  </p>
                ) : null}
                {(templateData?.getEmailTemplates ?? []).map((template) => (
                  <Card key={template.id} className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{template.name}</p>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7"
                        onClick={() => applyDraft(template.body, 'template agent')}
                      >
                        Use
                      </Button>
                    </div>
                    <p className="line-clamp-3 text-xs text-muted-foreground">
                      {template.body}
                    </p>
                  </Card>
                ))}
                {!templatesLoading &&
                !templatesError &&
                !(templateData?.getEmailTemplates ?? []).length ? (
                  <p className="p-2 text-xs text-muted-foreground">
                    No templates found for your account.
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="insights" className="mt-3 min-h-0 flex-1">
            <ScrollArea className="h-full rounded-md border border-border/70">
              <div className="space-y-3 p-3">
                {!threadInsights ? (
                  <p className="text-xs text-muted-foreground">
                    Select an email thread to view AI insights.
                  </p>
                ) : (
                  <>
                    <Card className="space-y-2 p-3">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">Conversation Snapshot</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Subject: {threadInsights.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Participants: {threadInsights.participantCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Messages: {threadInsights.messageCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last activity: {threadInsights.lastMessageDate}
                      </p>
                    </Card>

                    <Card className="space-y-2 p-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">Suggested Next Action</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {threadInsights.messageCount > 4
                          ? 'Send a concise summary reply with next-step commitments.'
                          : 'Respond quickly with a friendly acknowledgment and clear ask.'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Labels assigned: {threadInsights.hasLabels}
                      </p>
                    </Card>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
