'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { addDays, addHours, format, nextMonday } from 'date-fns';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import type { ToastActionElement } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface SnoozePopoverProps {
  emailId: string;
  onSnoozed?: (until: Date) => void;
  children?: React.ReactNode;
  className?: string;
}

const QUICK_SNOOZE_OPTIONS = [
  { label: 'In 2 hours', getValue: () => addHours(new Date(), 2) },
  { label: 'Tomorrow morning', getValue: () => { const d = addDays(new Date(), 1); d.setHours(9, 0, 0, 0); return d; } },
  { label: 'This weekend', getValue: () => { const d = new Date(); const day = d.getDay(); const daysUntilSat = (6 - day + 7) % 7 || 7; const sat = addDays(d, daysUntilSat); sat.setHours(9, 0, 0, 0); return sat; } },
  { label: 'Next Monday', getValue: () => { const d = nextMonday(new Date()); d.setHours(9, 0, 0, 0); return d; } },
  { label: 'In 1 week', getValue: () => addDays(new Date(), 7) },
];

export function SnoozePopover({
  emailId,
  onSnoozed,
  children,
  className,
}: SnoozePopoverProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>();

  const handleSnooze = (until: Date) => {
    setOpen(false);
    onSnoozed?.(until);
    toast({
      title: 'Email snoozed',
      description: `Will resurface ${format(until, 'PPP p')}`,
      action: (
        <button
          className="text-xs font-medium text-primary underline underline-offset-2"
          onClick={() => {
            // Undo snooze — re-show email
            toast({ title: 'Snooze cancelled' });
          }}
        >
          Undo
        </button>
      ) as ToastActionElement,
    });
    if (process.env.NODE_ENV !== 'production') {
      console.info('[SnoozePopover] snoozed', { emailId, until: until.toISOString() });
    }
  };

  const handleCustomDate = () => {
    if (!customDate) return;
    customDate.setHours(9, 0, 0, 0);
    handleSnooze(customDate);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7 text-muted-foreground hover:text-foreground', className)}
            aria-label="Snooze email"
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-0 rounded-xl border-border/60 shadow-xl">
        <div className="px-3 py-2.5 border-b">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Snooze until…
          </p>
        </div>

        {/* Quick options */}
        <div className="py-1.5">
          {QUICK_SNOOZE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => handleSnooze(opt.getValue())}
              className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-accent transition-colors"
            >
              <span>{opt.label}</span>
              <span className="text-muted-foreground/70 text-[11px]">
                {format(opt.getValue(), 'EEE, MMM d')}
              </span>
            </button>
          ))}
        </div>

        {/* Custom date picker */}
        <div className="border-t">
          <div className="px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              Pick a date
            </p>
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={setCustomDate}
              fromDate={new Date()}
              className="p-0"
            />
            <AnimatePresence>
              {customDate && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full h-7 text-xs"
                    onClick={handleCustomDate}
                  >
                    Snooze until {format(customDate, 'MMM d')} at 9 AM
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
