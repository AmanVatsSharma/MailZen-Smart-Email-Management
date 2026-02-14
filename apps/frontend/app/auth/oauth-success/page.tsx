'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unable to complete sign-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href={AUTH_ROUTES.login}>Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Completing sign-in</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Preparing your MailZen workspace...</span>
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Completing sign-in</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Preparing your MailZen workspace...</span>
      </CardContent>
    </Card>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <OAuthSuccessContent />
    </Suspense>
  );
}
