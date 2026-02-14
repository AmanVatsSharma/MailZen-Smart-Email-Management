'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createBrowserVoiceIO } from '@/lib/voice/voice-io';

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
  enableVoice?: boolean;
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
  enableVoice = false,
}: AgentAssistantProps) {
  const [draft, setDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceIo = useMemo(() => createBrowserVoiceIO(), []);
  const stopListeningRef = useRef<(() => void) | null>(null);

  const canUseVoice = enableVoice && voiceIo.isRecognitionSupported();
  const canUseSpeechSynthesis = enableVoice && voiceIo.isSpeechSynthesisSupported();

  useEffect(() => {
    return () => {
      stopListeningRef.current?.();
      voiceIo.stopSpeaking();
    };
  }, [voiceIo]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || loading) return;
    setDraft('');
    await onSend(value);
  };

  const startVoiceCapture = () => {
    if (!canUseVoice || loading || isListening) return;
    setVoiceError(null);
    stopListeningRef.current = voiceIo.startListening({
      onTranscript: (transcript) => {
        setDraft(transcript);
        void onSend(transcript);
      },
      onError: (message) => {
        setVoiceError(message);
      },
      onStateChange: (state) => {
        setIsListening(state);
      },
    });
  };

  const stopVoiceCapture = () => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
    setIsListening(false);
  };

  const speakLastAssistantMessage = () => {
    if (!canUseSpeechSynthesis) return;
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant');
    if (!lastAssistantMessage) return;
    voiceIo.speak(lastAssistantMessage.content);
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

        {voiceError ? (
          <p className="text-xs text-destructive">{voiceError}</p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            disabled={loading}
          />
          {enableVoice ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={isListening ? stopVoiceCapture : startVoiceCapture}
              disabled={loading || (!canUseVoice && !isListening)}
              title={
                canUseVoice
                  ? isListening
                    ? 'Stop voice capture'
                    : 'Start voice capture'
                  : 'Voice recognition not supported in this browser'
              }
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          {enableVoice ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={speakLastAssistantMessage}
              disabled={loading || messages.length === 0 || !canUseSpeechSynthesis}
              title="Read latest assistant message"
            >
              {canUseSpeechSynthesis ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          <Button type="submit" disabled={loading || draft.trim().length === 0}>
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
