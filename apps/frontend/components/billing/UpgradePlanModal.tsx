/**
 * File:        apps/frontend/components/billing/UpgradePlanModal.tsx
 * Module:      Frontend · Billing · Upgrade Prompt
 * Purpose:     Paywall modal shown when a FREE user attempts to access a Pro-only
 *              feature. Replaces raw error toasts with a conversion-focused prompt.
 *
 * Exports:
 *   - UpgradePlanModal({ open, onClose, featureName? })  — dismissible Dialog
 *
 * Depends on:
 *   - @/components/ui/dialog  — Modal primitive (shadcn/ui)
 *   - @/components/ui/button  — CTA buttons
 *   - next/link               — client-side navigation to billing page
 *
 * Side-effects: none (navigation only)
 *
 * Key invariants:
 *   - "Upgrade Now" navigates to /settings/billing?upgrade=pro (handled by billing page)
 *   - onClose is called both on "Dismiss" click and on Dialog onOpenChange
 *
 * Read order:
 *   1. UpgradePlanModal — only export
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-07
 */

'use client';

import Link from 'next/link';
import { Lock, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UpgradePlanModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
}

const PRO_HIGHLIGHTS = [
  'Unlimited automations',
  'Slack + webhook actions',
  'AI classify & draft-reply steps',
  'Full audit trail on every run',
];

export function UpgradePlanModal({
  open,
  onClose,
  featureName = 'Automation Engine',
}: UpgradePlanModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10">
            <Lock className="h-6 w-6 text-purple-500" />
          </div>
          <DialogTitle className="text-center text-lg font-bold">
            {featureName} requires Pro
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Upgrade to Pro to unlock automations, Slack notifications, AI action
            steps, and per-workspace audit logs.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold">Pro plan — $25/seat/mo</span>
          </div>
          {PRO_HIGHLIGHTS.map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            asChild
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            onClick={onClose}
          >
            <Link href="/settings/billing?upgrade=pro">
              Upgrade Now <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            asChild
            onClick={onClose}
          >
            <Link href="/features#automation">Learn more</Link>
          </Button>
          <button
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-1"
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
