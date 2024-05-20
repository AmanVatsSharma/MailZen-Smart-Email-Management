'use client';

import React, { useState } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown, RefreshCw, Check, Cpu, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock generated replies
const mockReplies = [
  {
    id: '1',
    text: "Thank you for reaching out. I appreciate your interest and will review your proposal. I'll get back to you with my thoughts by the end of the week.",
    tone: 'Professional',
    length: 'Medium',
  },
  {
    id: '2',
    text: "Thanks for your email! I'd be happy to discuss this further. How about we schedule a call next Tuesday?",
    tone: 'Friendly',
    length: 'Short',
  },
  {
    id: '3',
    text: "I've received your message and will carefully consider the information you've provided. Please allow me some time to review the details thoroughly before responding with a comprehensive answer.",
    tone: 'Formal',
    length: 'Long',
  },
];

interface SmartReplyProps {
  emailContent?: string;
  onSelectReply: (text: string) => void;
}

export function SmartReplySelector({ emailContent, onSelectReply }: SmartReplyProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [replies, setReplies] = useState(mockReplies);
  const [replyTone, setReplyTone] = useState<'Professional' | 'Friendly' | 'Formal'>(
    'Professional'
  );
  const [replyLength, setReplyLength] = useState<number>(50); // 0-100 scale

  const handleGenerateReplies = () => {
    setIsGenerating(true);
    // In a real app, this would call an API to generate smart replies
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  };

  const handleFeedback = (replyId: string, isPositive: boolean) => {
    // In a real app, this would send feedback to train the AI model
    console.log(`Feedback for reply ${replyId}: ${isPositive ? 'positive' : 'negative'}`);
  };

  const getLengthLabel = (value: number) => {
    if (value < 33) return 'Short';
    if (value < 66) return 'Medium';
    return 'Long';
  };

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

      <div className="grid grid-cols-1 gap-3">
        {isGenerating ? (
          <div className="flex items-center justify-center py-10 border rounded-md bg-muted/20">
            <div className="flex flex-col items-center">
              <Cpu className="h-8 w-8 mb-2 text-muted-foreground animate-pulse" />
              <p className="text-sm text-muted-foreground">Generating smart replies...</p>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
