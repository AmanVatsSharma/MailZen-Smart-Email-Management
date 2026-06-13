'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/tokens/cn';
import { Skeleton } from '@/components/ui/skeleton';

interface ActionItem {
  text: string;
  done?: boolean;
}

interface EmailAiInsightCardProps {
  summary?: string | null;
  actionItems?: ActionItem[];
  keyPeople?: string[];
  deadlines?: string[];
  isLoading?: boolean;
  className?: string;
}

function SectionHeader({
  icon,
  title,
  count,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between py-2 text-left"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary/80">{icon}</span>
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
            {count}
          </span>
        )}
      </div>
      {open ? (
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

export function EmailAiInsightCard({
  summary,
  actionItems = [],
  keyPeople = [],
  deadlines = [],
  isLoading = false,
  className,
}: EmailAiInsightCardProps) {
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [peopleOpen, setPeopleOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={cn('space-y-3 rounded-xl border border-border/40 bg-card/60 p-4', className)}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <Skeleton className="h-12 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>
    );
  }

  if (!summary && actionItems.length === 0 && keyPeople.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm divide-y divide-border/40',
        className,
      )}
    >
      {/* Summary section */}
      {summary && (
        <div className="px-4">
          <SectionHeader
            icon={<Sparkles className="h-3.5 w-3.5" />}
            title="AI Summary"
            open={summaryOpen}
            onToggle={() => setSummaryOpen(!summaryOpen)}
          />
          <AnimatePresence initial={false}>
            {summaryOpen && (
              <motion.div
                key="summary-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="pb-3 text-xs leading-relaxed text-muted-foreground">
                  {summary}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Action items section */}
      {actionItems.length > 0 && (
        <div className="px-4">
          <SectionHeader
            icon={<CheckSquare className="h-3.5 w-3.5" />}
            title="Action Items"
            count={actionItems.length}
            open={actionsOpen}
            onToggle={() => setActionsOpen(!actionsOpen)}
          />
          <AnimatePresence initial={false}>
            {actionsOpen && (
              <motion.div
                key="actions-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ul className="pb-3 space-y-1.5">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <CheckSquare
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0',
                          item.done
                            ? 'text-emerald-500'
                            : 'text-muted-foreground',
                        )}
                      />
                      <span
                        className={cn(
                          item.done
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground/80',
                        )}
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Deadlines */}
      {deadlines.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2.5">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <div className="space-y-0.5">
            {deadlines.map((d, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                {d}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Key people section */}
      {keyPeople.length > 0 && (
        <div className="px-4">
          <SectionHeader
            icon={<Users className="h-3.5 w-3.5" />}
            title="Key People"
            count={keyPeople.length}
            open={peopleOpen}
            onToggle={() => setPeopleOpen(!peopleOpen)}
          />
          <AnimatePresence initial={false}>
            {peopleOpen && (
              <motion.div
                key="people-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 pb-3">
                  {keyPeople.map((person, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {person}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
