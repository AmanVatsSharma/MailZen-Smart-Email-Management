'use client';

/**
 * ComposeCopilot
 *
 * Floating AI co-pilot panel for the email composer.
 * Shows inline suggestions when the user types `//` in the body,
 * and provides subject line suggestions + tone picker.
 *
 * Phase 10f — Composer AI Co-pilot
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  WandSparkles,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type CopilotTone = 'professional' | 'friendly' | 'concise' | 'formal';

interface ComposeCopilotProps {
  /** Current email subject for generating suggestions */
  subject?: string;
  /** Current body content */
  body?: string;
  /** Current tone selection */
  tone: CopilotTone;
  onToneChange: (tone: CopilotTone) => void;
  onApplySubjectSuggestion: (suggestion: string) => void;
  onApplyBodyAction: (action: string) => void;
  /** Whether an AI action is currently running */
  isGenerating?: boolean;
  className?: string;
}

const TONES: { value: CopilotTone; label: string; emoji: string }[] = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
  { value: 'concise', label: 'Concise', emoji: '✂️' },
  { value: 'formal', label: 'Formal', emoji: '🎩' },
];

const BODY_ACTIONS = [
  { key: 'continue', label: '✨ Continue writing' },
  { key: 'formal', label: '🎩 Make more formal' },
  { key: 'shorter', label: '✂️ Make shorter' },
  { key: 'cta', label: '📢 Add call to action' },
  { key: 'friendly', label: '😊 Make friendlier' },
];

export function ComposeCopilot({
  subject,
  body,
  tone,
  onToneChange,
  onApplySubjectSuggestion,
  onApplyBodyAction,
  isGenerating = false,
  className,
}: ComposeCopilotProps) {
  const [showPanel, setShowPanel] = useState(false);

  const subjectSuggestions: string[] = [];
  if (subject && subject.length <= 20 && !subject.startsWith('Re:') && !subject.startsWith('Fwd:')) {
    subjectSuggestions.push(`Following up: ${subject}`);
    subjectSuggestions.push(`${subject} — Action Required`);
  }

  return (
    <div className={cn('relative', className)}>
      {/* Trigger button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs text-primary/70 hover:text-primary hover:bg-primary/5 border border-primary/20 rounded-lg"
        onClick={() => setShowPanel((v) => !v)}
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        Copilot
        <ChevronDown
          className={cn(
            'h-2.5 w-2.5 opacity-60 transition-transform',
            showPanel && 'rotate-180',
          )}
        />
      </Button>

      {/* Floating panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 z-50 w-60 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden"
          >
            {/* Tone picker */}
            <div className="border-b px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Tone
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge
                    variant="outline"
                    className="cursor-pointer gap-1 px-2 py-1 text-[11px] font-normal hover:bg-muted"
                  >
                    {TONES.find((t) => t.value === tone)?.emoji}{' '}
                    {TONES.find((t) => t.value === tone)?.label}
                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[140px]">
                  <DropdownMenuLabel className="text-xs">Tone</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {TONES.map((t) => (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={() => onToneChange(t.value)}
                      className={tone === t.value ? 'text-primary font-medium' : ''}
                    >
                      {t.emoji} {t.label}
                      {tone === t.value && <span className="ml-auto text-primary">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Body actions */}
            <div className="border-b">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Body actions
              </p>
              {BODY_ACTIONS.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => {
                    onApplyBodyAction(action.key);
                    setShowPanel(false);
                  }}
                  className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  disabled={isGenerating}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Subject suggestions */}
            {subjectSuggestions.length > 0 && (
              <div>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Subject suggestions
                </p>
                {subjectSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onApplySubjectSuggestion(s);
                      setShowPanel(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  >
                    <WandSparkles className="h-3 w-3 text-primary/60 shrink-0" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="px-3 py-1.5 border-t">
              <p className="text-[10px] text-muted-foreground/60">
                Type <kbd className="text-[9px] bg-muted px-1 rounded">//</kbd> in the body for quick AI actions
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
