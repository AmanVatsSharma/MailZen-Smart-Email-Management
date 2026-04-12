'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GET_PROVIDERS } from '@/lib/apollo/queries/providers';

const ONBOARDING_DISMISSED_KEY = 'mailzen_onboarding_banner_dismissed';

const PROVIDER_CONNECT_PATHS = ['/email-providers', '/settings'];

export function OnboardingBanner() {
  const pathname = usePathname();
  const router = useRouter();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1';
  });

  const isOnProviderPage = PROVIDER_CONNECT_PATHS.some(
    (path) => pathname?.startsWith(path),
  );

  const { data, loading } = useQuery(GET_PROVIDERS, {
    fetchPolicy: 'network-only',
    skip: dismissed || isOnProviderPage,
  });

  const providers = (data?.providers as { id: string; isActive: boolean }[] | undefined) ?? [];
  const hasConnectedProvider = providers.some((p) => p.isActive);

  const shouldShow =
    !dismissed &&
    !isOnProviderPage &&
    !loading &&
    data !== undefined &&
    !hasConnectedProvider;

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
    }
    setDismissed(true);
  };

  const handleConnect = () => {
    router.push('/email-providers');
  };

  if (loading && !dismissed && !isOnProviderPage) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/40 border-b">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking email providers...
      </div>
    );
  }

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/5 border-b border-primary/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Connect your first email provider</p>
                <p className="text-xs text-muted-foreground truncate">
                  Link Gmail or Outlook to start reading and sending emails from MailZen.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="gap-1 text-xs" onClick={handleConnect}>
                Connect now
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Dismiss setup banner"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
