'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown, RefreshCw, Check, Cpu, ChevronDown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLazyQuery, useQuery } from '@apollo/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { GET_SUGGESTED_REPLIES } from '@/lib/apollo/queries/smart-replies';
import { GET_SMART_REPLY_SETTINGS } from '@/lib/apollo/queries/smart-reply-settings';

interface SmartReplyProps {
  emailContent?: string;
  onSelectReply: (_text: string) => void;
  autoGenerate?: boolean;
}

interface ReplySuggestion {
  id: string;
  text: string;
  tone: 'Professional' | 'Friendly' | 'Formal';
  length: 'Short' | 'Medium' | 'Long';
}

export function SmartReplySelector({ emailContent, onSelectReply, autoGenerate = false }: SmartReplyProps) {
  const { toast } = useToast();
  const [replies, setReplies] = useState<ReplySuggestion[]>([]);
  const [replyTone, setReplyTone] = useState<'Professional' | 'Friendly' | 'Formal'>(
    'Professional'
  );
  const [replyLength, setReplyLength] = useState<number>(50); // 0-100 scale
  const [lastError, setLastError] = useState<string | null>(null);
  const { data: settingsData } = useQuery(GET_SMART_REPLY_SETTINGS, {
    fetchPolicy: 'cache-first',
  });

  const getLengthLabel = (value: number): 'Short' | 'Medium' | 'Long' => {
    if (value < 33) return 'Short';
    if (value < 66) return 'Medium';
    return 'Long';
  };

  const [getSuggestedReplies, { loading: suggestionsLoading, error: suggestionsError }] = useLazyQuery<{
    getSuggestedReplies: string[];
  }>(GET_SUGGESTED_REPLIES, {
    fetchPolicy: 'no-cache',
    onCompleted: (data) => {
      const items = data?.getSuggestedReplies || [];
      setReplies(
        items.map((text, index) => ({
          id: `reply-${index}`,
          text,
          tone: replyTone,
          length: getLengthLabel(replyLength),
        }))
      );
      setLastError(null);
    },
    onError: (err) => {
      setLastError(err.message || 'Failed to generate smart replies');
      toast({
        title: 'Smart reply failed',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const canGenerate = useMemo(() => {
    return !!emailContent && emailContent.trim().length > 0;
  }, [emailContent]);

  const smartReplySettings = settingsData?.smartReplySettings;

  const handleGenerateReplies = () => {
    if (smartReplySettings && !smartReplySettings.enabled) {
      toast({
        title: 'Smart replies are disabled',
        description: 'Enable Smart Replies in settings to generate suggestions.',
        variant: 'destructive',
      });
      return;
    }

    if (!canGenerate) {
      toast({
        title: 'No email context',
        description: 'Open an email (or provide content) to generate smart replies.',
        variant: 'destructive',
      });
      return;
    }

    setLastError(null);
    getSuggestedReplies({
      variables: {
        emailBody: emailContent!,
        count: smartReplySettings?.maxSuggestions ?? 3,
      },
    });
  };

  const handleFeedback = (replyId: string, isPositive: boolean) => {
    // In a real app, this would send feedback to train the AI model
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Feedback for reply ${replyId}: ${isPositive ? 'positive' : 'negative'}`);
    }
    toast({
      title: 'Feedback recorded',
      description: 'Thanks — this helps improve suggestions.',
    });
  };

  useEffect(() => {
    if (autoGenerate && canGenerate) handleGenerateReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, canGenerate]);

  useEffect(() => {
    if (!smartReplySettings) return;
    const tone = String(smartReplySettings.defaultTone || '').toLowerCase();
    if (tone === 'friendly') setReplyTone('Friendly');
    else if (tone === 'formal') setReplyTone('Formal');
    else setReplyTone('Professional');

    const length = String(smartReplySettings.defaultLength || '').toLowerCase();
    if (length === 'short') setReplyLength(20);
    else if (length === 'long') setReplyLength(80);
    else setReplyLength(50);
  }, [smartReplySettings]);

  const isGenerating = suggestionsLoading;
  const errorMessage = lastError || suggestionsError?.message || null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium flex items-center">
            <Sparkles className="h-4 w-4 text-primary mr-1" />
            Smart Reply
          </h3>
          <Badge variant="outline" className="text-xs">
            AI Powered
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                <span>{replyTone}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setReplyTone('Professional')}>
                Professional
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setReplyTone('Friendly')}>Friendly</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setReplyTone('Formal')}>Formal</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                <span>{getLengthLabel(replyLength)}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-4">
              <div className="space-y-2">
                <div className="text-xs font-medium mb-1">Response Length</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Short</span>
                  <span className="text-xs">Long</span>
                </div>
                <Slider
                  defaultValue={[replyLength]}
                  max={100}
                  step={1}
                  onValueChange={value => setReplyLength(value[0])}
                  className="w-full"
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleGenerateReplies}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3">
        {isGenerating ? (
          <div className="flex items-center justify-center py-10 border rounded-md bg-muted/20">
            <div className="flex flex-col items-center">
              <Cpu className="h-8 w-8 mb-2 text-muted-foreground animate-pulse" />
              <p className="text-sm text-muted-foreground">Generating smart replies...</p>
            </div>
          </div>
        ) : replies.length ? (
          replies.map(reply => (
            <Card
              key={reply.id}
              className="p-3 hover:bg-secondary/5 cursor-pointer border-secondary/20 transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 text-sm">{reply.text}</div>
                <div className="flex flex-col gap-1 mt-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:text-primary hover:bg-primary/10"
                    onClick={() => handleFeedback(reply.id, true)}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleFeedback(reply.id, false)}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {reply.tone}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {reply.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs hover:bg-primary hover:text-primary-foreground"
                  onClick={() => onSelectReply(reply.text)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Use
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {canGenerate ? 'Click “Regenerate” to generate smart replies.' : 'Open an email to generate smart replies.'}
          </div>
        )}
      </div>
    </div>
  );
}
