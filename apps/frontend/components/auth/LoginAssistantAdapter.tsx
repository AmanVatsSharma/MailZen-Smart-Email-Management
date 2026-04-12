'use client';

import { useMemo, useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import {
  AgentAssistant,
  AgentAssistantAction,
  AgentAssistantCreditsHint,
  AgentAssistantMessage,
} from '@/components/ai/AgentAssistant';
import { parseActionPayload } from '@/components/ai/agent-assistant.utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { AGENT_ASSIST_MUTATION } from '@/lib/apollo/queries/agent-assistant';
import { GET_ENTITLEMENT_USAGE } from '@/lib/apollo/queries/billing';

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
    aiCreditsMonthlyLimit?: number | null;
    aiCreditsUsed?: number | null;
    aiCreditsRemaining?: number | null;
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
    context: { surface: string; locale: string; email?: string };
    allowedActions: string[];
    requestedAction?: string;
    executeRequestedAction?: boolean;
    requestedActionApprovalToken?: string;
  };
};

const allowedActions = [
  'auth.forgot_password',
  'auth.open_register',
  'auth.open_login',
  'auth.send_signup_otp',
];

const toGraphMessages = (
  messages: AgentAssistantMessage[],
): AgentAssistVariables['input']['messages'] => {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
};

export function LoginAssistantAdapter() {
  const router = useRouter();
  const { toast } = useToast();
  const client = useApolloClient();
  const [emailContext, setEmailContext] = useState('');
  const [messages, setMessages] = useState<AgentAssistantMessage[]>([]);
  const [actions, setActions] = useState<AgentAssistantAction[]>([]);
  const [creditsHint, setCreditsHint] = useState<AgentAssistantCreditsHint | null>(null);

  const [assist, { loading }] = useMutation<AgentAssistData, AgentAssistVariables>(
    AGENT_ASSIST_MUTATION,
    {
      onError: (error) => {
        toast({
          title: 'Assistant unavailable',
          description: error.message,
          variant: 'destructive',
        });
      },
    },
  );

  const conversation = useMemo(() => messages.slice(-8), [messages]);

  const applyCreditsFromResponse = (response: AgentAssistData['agentAssist']) => {
    if (
      response.aiCreditsRemaining != null ||
      response.aiCreditsMonthlyLimit != null ||
      response.aiCreditsUsed != null
    ) {
      setCreditsHint({
        remaining: response.aiCreditsRemaining ?? undefined,
        limit: response.aiCreditsMonthlyLimit ?? undefined,
        used: response.aiCreditsUsed ?? undefined,
      });
    }
    void client.refetchQueries({ include: [GET_ENTITLEMENT_USAGE] });
  };

  const askAssistant = async (
    nextMessages: AgentAssistantMessage[],
    requestedAction?: string,
    executeRequestedAction?: boolean,
    requestedActionApprovalToken?: string,
  ) => {
    const result = await assist({
      variables: {
        input: {
          skill: 'auth',
          messages: toGraphMessages(nextMessages.slice(-8)),
          context: {
            surface: 'auth-login',
            locale: 'en-IN',
            email: emailContext || undefined,
          },
          allowedActions,
          requestedAction,
          executeRequestedAction: executeRequestedAction ?? false,
          ...(requestedActionApprovalToken
            ? { requestedActionApprovalToken: requestedActionApprovalToken }
            : {}),
        },
      },
    });

    const response = result.data?.agentAssist;
    if (!response) return;

    applyCreditsFromResponse(response);
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

  const resolveExecuteToken = (action: AgentAssistantAction): string | undefined => {
    if (action.requiresApproval && !action.approvalToken) {
      return undefined;
    }
    return action.approvalToken || undefined;
  };

  const handleAction = async (action: AgentAssistantAction) => {
    const actionPayload = parseActionPayload(action.payloadJson);
    if (action.name === 'auth.open_register') {
      router.push('/auth/register');
      return;
    }

    if (action.name === 'auth.open_login') {
      toast({
        title: 'Login ready',
        description: 'Use the login form on the left to continue sign in.',
      });
      return;
    }

    if (action.name === 'auth.forgot_password') {
      const effectiveEmail = emailContext || actionPayload.email;
      if (!effectiveEmail) {
        toast({
          title: 'Email required',
          description: 'Add your email in assistant context to trigger reset flow.',
          variant: 'destructive',
        });
        return;
      }

      if (!emailContext && effectiveEmail) {
        setEmailContext(effectiveEmail);
      }

      const token = resolveExecuteToken(action);
      if (action.requiresApproval && !token) {
        toast({
          title: 'Approval unavailable',
          description: 'Ask the assistant again to get a fresh approval for this action.',
          variant: 'destructive',
        });
        return;
      }

      await askAssistant(conversation, action.name, true, token);
      router.push('/auth/forgot-password');
      return;
    }

    const token = resolveExecuteToken(action);
    if (action.requiresApproval && !token) {
      toast({
        title: 'Approval unavailable',
        description: 'Ask the assistant again to get a fresh approval for this action.',
        variant: 'destructive',
      });
      return;
    }

    await askAssistant(conversation, action.name, true, token);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-border/60 p-3">
        <Label htmlFor="assistant-email-context">Email context (optional)</Label>
        <Input
          id="assistant-email-context"
          value={emailContext}
          onChange={(event) => setEmailContext(event.target.value)}
          placeholder="name@example.com"
        />
      </div>

      <AgentAssistant
        title="AI Login Assistant"
        description="General agent platform skill for auth guidance and safe action suggestions."
        placeholder="Ask about login, OTP, or account recovery..."
        messages={messages}
        actions={actions}
        loading={loading}
        onSend={handleSend}
        onAction={handleAction}
        enableVoice
        creditsHint={creditsHint}
      />
    </div>
  );
}
