'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AUTH_ME_QUERY,
  AUTH_ROUTES,
  CREATE_MY_MAILBOX_MUTATION,
  setUserData,
} from '@/modules/auth';

const HANDLE_PATTERN = /^[a-z0-9]+(?:[a-z0-9.]{1,28}[a-z0-9])?$/;

const buildSuggestedHandle = (email?: string | null): string => {
  const localPart = (email || 'mailzen.user').split('@')[0]?.toLowerCase() || '';
  const cleaned = localPart
    .replace(/[^a-z0-9.]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');

  if (cleaned.length >= 3) {
    return cleaned.slice(0, 30);
  }

  return 'mailzen.user';
};

export default function AliasSelectPage() {
  const router = useRouter();
  const [redirectAfterSetup, setRedirectAfterSetup] = useState<string>(
    AUTH_ROUTES.dashboard,
  );

  const [handle, setHandle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectTarget = params.get('redirect');
    if (redirectTarget) {
      setRedirectAfterSetup(redirectTarget);
    }
  }, []);

  const { data, loading } = useQuery(AUTH_ME_QUERY, {
    fetchPolicy: 'network-only',
  });

  const authMe = data?.authMe;
  const hasAlias = Boolean(authMe?.hasMailzenAlias);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!authMe?.user) {
      router.replace(AUTH_ROUTES.login);
      return;
    }

    setUserData(authMe.user);

    if (hasAlias) {
      router.replace(redirectAfterSetup);
      return;
    }

    setHandle((prev) => prev || buildSuggestedHandle(authMe.user.email));
  }, [authMe, hasAlias, loading, redirectAfterSetup, router]);

  const [createMailbox, { loading: createMailboxLoading }] = useMutation(
    CREATE_MY_MAILBOX_MUTATION,
    {
      onCompleted: () => {
        router.replace(redirectAfterSetup);
      },
      onError: (error) => {
        setErrorMessage(error.message || 'Unable to create @mailzen.com address');
      },
    },
  );

  const normalizedHandle = useMemo(() => {
    return handle.trim().toLowerCase();
  }, [handle]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!HANDLE_PATTERN.test(normalizedHandle)) {
      setErrorMessage(
        'Use 3-30 characters: lowercase letters, numbers, and dots. Dot cannot start or end the handle.',
      );
      return;
    }

    await createMailbox({
      variables: {
        desiredLocalPart: normalizedHandle,
      },
    });
  };

  return (
    <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-1 p-4">
      <div>
        <h1 className="text-base font-semibold leading-none tracking-tight">Choose your MailZen address</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You must create your unique <strong>@mailzen.com</strong> address before entering the dashboard.
        </p>
      </div>
      <div className="space-y-4 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="mailzen-handle" className="text-sm font-medium">
              MailZen handle
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="mailzen-handle"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder="your.name"
                  className="pl-9"
                  autoComplete="off"
                  maxLength={30}
                  required
                />
              </div>
              <span className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                @mailzen.com
              </span>
            </div>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900"
            >
              {errorMessage}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={createMailboxLoading || loading}>
            {createMailboxLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating address...
              </>
            ) : (
              'Continue to dashboard'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
