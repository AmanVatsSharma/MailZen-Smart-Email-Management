'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AUTH_ME_QUERY,
  AUTH_ROUTES,
  resolvePostAuthRoute,
  setUserData,
} from '@/modules/auth';

function OAuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerError = searchParams.get('error');

  const { data, loading, error } = useQuery(AUTH_ME_QUERY, {
    fetchPolicy: 'network-only',
    skip: Boolean(providerError),
  });

  useEffect(() => {
    if (providerError || loading) {
      return;
    }

    const authMe = data?.authMe;
    if (!authMe?.user) {
      router.replace(AUTH_ROUTES.login);
      return;
    }

    setUserData(authMe.user);
    router.replace(
      resolvePostAuthRoute({
        requiresAliasSetup: authMe.requiresAliasSetup,
        nextStep: authMe.nextStep,
      }),
    );
  }, [data, loading, providerError, router]);

  if (providerError || error) {
    const message = providerError || 'Google sign-in failed. Please try again.';
    return (
      <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-1 p-4">
        <div>
          <h1 className="text-base font-semibold leading-none tracking-tight">Unable to complete sign-in</h1>
        </div>
        <div className="space-y-4 pt-4">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900"
          >
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>{message}</span>
          </div>
          <Button asChild className="w-full">
            <Link href={AUTH_ROUTES.login}>Back to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-1 p-4">
      <div>
        <h1 className="text-base font-semibold leading-none tracking-tight">Completing sign-in</h1>
      </div>
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Preparing your MailZen workspace...</span>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-1 p-4">
      <div>
        <h1 className="text-base font-semibold leading-none tracking-tight">Completing sign-in</h1>
      </div>
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Preparing your MailZen workspace...</span>
      </div>
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <OAuthSuccessContent />
    </Suspense>
  );
}
