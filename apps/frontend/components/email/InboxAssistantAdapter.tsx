'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@apollo/client';
import { AgentAssistant, AgentAssistantAction, AgentAssistantMessage } from '@/components/ai/AgentAssistant';
import { parseActionPayload } from '@/components/ai/agent-assistant.utils';
import { useToast } from '@/components/ui/use-toast';
import { AGENT_ASSIST_MUTATION } from '@/lib/apollo/queries/agent-assistant';
import type { EmailThread } from '@/lib/email/email-types';

interface InboxAssistantAdapterProps {
  selectedThread: EmailThread | null;
  onUseDraft: (draft: string) => void;
}

type AgentAssistData = {
  agentAssist: {
    requestId: string;
    assistantText: string;
    intent: string;
    confidence: number;
    suggestedActions: AgentAssistantAction[];
    safetyFlags: Array<{
      code: string;
      severity: string;
      message: string;
    }>;
    executedAction?: {
      action: string;
      executed: boolean;
      message: string;
    } | null;
  };
};

type AgentAssistVariables = {
  input: {
    skill: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    context: {
      surface: string;
      locale: string;
      metadataJson?: string;
    };
    allowedActions: string[];
    requestedAction?: string;
    executeRequestedAction?: boolean;
  };
};

const allowedActions = [
  'inbox.summarize_thread',
  'inbox.compose_reply_draft',
  'inbox.open_thread',
];

const toGraphMessages = (
  messages: AgentAssistantMessage[],
): AgentAssistVariables['input']['messages'] =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

const buildThreadMetadataJson = (thread: EmailThread | null): string | undefined => {
  if (!thread) return undefined;
  const lastMessage = thread.messages[thread.messages.length - 1];
  return JSON.stringify({
    threadId: thread.id,
    subject: thread.subject,
    participantCount: thread.participants.length,
    lastMessagePreview: lastMessage?.contentPreview || '',
  });
};

export function InboxAssistantAdapter({
  selectedThread,
  onUseDraft,
}: InboxAssistantAdapterProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AgentAssistantMessage[]>([]);
  const [actions, setActions] = useState<AgentAssistantAction[]>([]);

  const [assist, { loading }] = useMutation<AgentAssistData, AgentAssistVariables>(
    AGENT_ASSIST_MUTATION,
    {
      onError: (error) => {
        toast({
          title: 'Inbox assistant unavailable',
          description: error.message,
          variant: 'destructive',
        });
      },
    },
  );

  const conversation = useMemo(() => messages.slice(-10), [messages]);

  const askAssistant = async (
    nextMessages: AgentAssistantMessage[],
    requestedAction?: string,
    executeRequestedAction?: boolean,
  ) => {
    const result = await assist({
      variables: {
        input: {
          skill: 'inbox',
          messages: toGraphMessages(nextMessages.slice(-10)),
          context: {
            surface: 'inbox',
            locale: 'en-IN',
            metadataJson: buildThreadMetadataJson(selectedThread),
          },
          allowedActions,
          requestedAction,
          executeRequestedAction,
        },
      },
    });

    const response = result.data?.agentAssist;
    if (!response) return;

    setActions(response.suggestedActions || []);
    const updatedMessages: AgentAssistantMessage[] = [
      ...nextMessages,
      { role: 'assistant', content: response.assistantText },
    ];
    if (response.executedAction?.message) {
      updatedMessages.push({
        role: 'assistant',
        content: response.executedAction.message,
      });
    }
    setMessages(updatedMessages);

    const warning = response.safetyFlags.find((flag) => flag.severity === 'warn');
    if (warning) {
      toast({
        title: 'Security tip',
        description: warning.message,
      });
    }
  };

  const handleSend = async (message: string) => {
    const nextMessages: AgentAssistantMessage[] = [
      ...conversation,
      { role: 'user', content: message },
    ];
    setMessages(nextMessages);
    await askAssistant(nextMessages);
  };

  const handleAction = async (action: AgentAssistantAction) => {
    const payload = parseActionPayload(action.payloadJson);
    if (action.name === 'inbox.compose_reply_draft') {
      const draft = payload.draft || 'Thanks for your message. Here is my proposed response...';
      onUseDraft(draft);
      toast({
        title: 'Draft inserted',
        description: 'Inbox assistant prepared a draft in composer.',
      });
      return;
    }

    if (action.name === 'inbox.open_thread') {
      toast({
        title: 'Thread focus',
        description:
          selectedThread?.subject || 'Select a thread from list to inspect details.',
      });
    }

    await askAssistant(conversation, action.name, true);
  };

  return (
    <AgentAssistant
      title="Inbox Assistant"
      description="General agent platform skill for inbox summaries, reply drafts, and navigation."
      placeholder="Ask to summarize thread or draft a reply..."
      messages={messages}
      actions={actions}
      loading={loading}
      onSend={handleSend}
      onAction={handleAction}
      enableVoice
    />
  );
}
