'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export type AgentAssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentAssistantAction = {
  name: string;
  label: string;
  payloadJson?: string | null;
};

interface AgentAssistantProps {
  title: string;
  description: string;
  placeholder?: string;
  messages: AgentAssistantMessage[];
  actions: AgentAssistantAction[];
  loading?: boolean;
  onSend: (message: string) => void | Promise<void>;
  onAction: (action: AgentAssistantAction) => void | Promise<void>;
}

export function AgentAssistant({
  title,
  description,
  placeholder = 'Ask for help...',
  messages,
  actions,
  loading = false,
  onSend,
  onAction,
}: AgentAssistantProps) {
  const [draft, setDraft] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || loading) return;
    setDraft('');
    await onSend(value);
  };

  return (
    <Card className="premium-card h-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex h-[500px] flex-col gap-4">
        <div className="flex-1 space-y-2 overflow-y-auto rounded-md border border-border/60 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask anything about login, signup, OTP, or password reset.
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-md px-3 py-2 text-sm ${
                  message.role === 'assistant'
                    ? 'bg-muted text-foreground'
                    : 'ml-auto max-w-[85%] bg-primary text-primary-foreground'
                }`}
              >
                {message.content}
              </div>
            ))
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          ) : null}
        </div>

        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={`${action.name}-${action.label}`}
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => onAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || draft.trim().length === 0}>
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
