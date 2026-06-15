'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AUTH_ROUTES, RESET_PASSWORD_MUTATION } from '@/modules/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
  }, []);

  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD_MUTATION, {
    onCompleted: () => {
      setSuccessMessage('Password updated successfully. Redirecting to login...');
      setTimeout(() => router.replace(AUTH_ROUTES.login), 800);
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Unable to reset password.');
    },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Missing reset token. Request a new password reset link.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    await resetPassword({
      variables: {
        token,
        newPassword: password,
      },
    });
  };

  return (
    <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-1 p-4">
      <div>
        <h1 className="text-base font-semibold leading-none tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground mt-1">Set a new password to secure your MailZen account.</p>
      </div>
      <div className="space-y-4 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
          />

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900"
            >
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-info-200 bg-info-50 p-3 text-sm text-info-900"
            >
              {successMessage}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating password...' : 'Update password'}
          </Button>
        </form>

        <Button asChild variant="ghost" className="w-full">
          <Link href={AUTH_ROUTES.login}>Back to login</Link>
        </Button>
      </div>
    </div>
  );
}
