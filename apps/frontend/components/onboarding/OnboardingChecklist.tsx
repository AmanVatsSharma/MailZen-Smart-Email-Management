/**
 * File:        apps/frontend/components/onboarding/OnboardingChecklist.tsx
 * Module:      Frontend · Onboarding · Getting-started checklist
 * Purpose:     3-step "getting started" card shown to new workspace admins on the
 *              dashboard until all steps are complete or they dismiss it.
 *
 * Exports:
 *   - OnboardingChecklist({ providerUsed, workspaceId })  — dismissible checklist card
 *
 * Depends on:
 *   - GET_AUTOMATIONS  — queries automation count + ENABLED status
 *   - @/components/ui/card, button, badge  — shadcn/ui
 *
 * Side-effects:
 *   - Reads/writes `mailzen.onboarding.dismissed` from localStorage
 *   - Apollo query for automations list on mount
 *
 * Key invariants:
 *   - Dismissed state is client-side only (localStorage) — resets on new device/browser
 *   - Hidden entirely when dismissed; shows "You're all set!" when all 3 steps complete
 *   - Skips automation query when workspaceId is not available
 *
 * Read order:
 *   1. STEPS constant — step definitions
 *   2. OnboardingChecklist — main component
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-07
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { CheckCircle2, Circle, X, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GET_AUTOMATIONS } from '@/lib/apollo/queries/automations';

interface OnboardingChecklistProps {
  providerUsed?: number;
  workspaceId?: string | null;
}

const DISMISSED_KEY = 'mailzen.onboarding.dismissed';

const STEPS = [
  {
    title: 'Connect your email',
    description: 'Link your Gmail or Outlook account so MailZen can manage your inbox.',
    action: { label: 'Connect email', href: '/email-providers' },
  },
  {
    title: 'Create your first automation',
    description: 'Build a "when X happens, do Y" rule to automate repetitive email tasks.',
    action: { label: 'New automation', href: '/automations/new' },
  },
  {
    title: 'Enable your automation',
    description: 'Switch your automation to Enabled so it fires on real incoming emails.',
    action: { label: 'View automations', href: '/automations' },
  },
];

export function OnboardingChecklist({ providerUsed, workspaceId }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
  }, []);

  const { data } = useQuery<{
    automations: { nodes: Array<{ status: string }> };
  }>(GET_AUTOMATIONS, {
    variables: { workspaceId: workspaceId ?? '', limit: 50 },
    skip: !workspaceId,
    fetchPolicy: 'cache-and-network',
  });

  const automations = data?.automations.nodes ?? [];
  const hasAutomation = automations.length > 0;
  const hasEnabledAutomation = automations.some((a) => a.status === 'ENABLED');

  const stepComplete = [
    (providerUsed ?? 0) > 0,
    hasAutomation,
    hasEnabledAutomation,
  ];

  const allComplete = stepComplete.every(Boolean);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <Card className="mb-6 rounded-2xl border-purple-500/20 bg-purple-500/5">
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15">
            <Zap className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {allComplete ? 'You\'re all set!' : 'Get started with MailZen'}
            </p>
            <p className="text-xs text-muted-foreground">
              {allComplete
                ? 'Your workspace is fully configured. Welcome to the team!'
                : `${stepComplete.filter(Boolean).length} of ${STEPS.length} steps complete`}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="mt-0.5 rounded-md p-1 text-muted-foreground/60 hover:bg-muted/60 hover:text-muted-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3">
        {STEPS.map((step, i) => {
          const done = stepComplete[i];
          return (
            <div
              key={step.title}
              className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                done
                  ? 'border-purple-500/15 bg-purple-500/5 opacity-60'
                  : 'border-border/50 bg-background/60'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {done ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-purple-500 h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
                  {step.title}
                </p>
                {!done && (
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                )}
              </div>
              {!done && (
                <Button asChild size="sm" variant="outline" className="shrink-0 h-7 text-xs border-purple-500/20 text-purple-600 hover:bg-purple-500/10 hover:text-purple-600">
                  <Link href={step.action.href}>{step.action.label}</Link>
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
