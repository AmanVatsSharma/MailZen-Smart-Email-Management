'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { useMutation } from '@apollo/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getGoogleOAuthStartUrl,
  LOGIN_MUTATION,
  resolvePostAuthRoute,
  setUserData,
} from '@/modules/auth';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const [login, { loading }] = useMutation(LOGIN_MUTATION, {
    onCompleted: (data) => {
      setUserData(data.login.user);
      router.push(
        resolvePostAuthRoute({
          requiresAliasSetup: data.login.requiresAliasSetup,
          nextStep: data.login.nextStep,
        }),
      );
    },
    onError: (err) => {
      setError(err.message || 'An error occurred during login. Please try again.');
    },
  });

  const handleLogin = async (values: FormValues) => {
    setError(null);
    await login({
      variables: { loginInput: { email: values.email, password: values.password } },
    });
  };

  const handleGoogleSignIn = () => {
    window.location.href = getGoogleOAuthStartUrl();
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-8 shadow-2xl"
      style={{
        background: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border) / 0.6)',
        boxShadow: '0 25px 60px hsl(222 47% 5% / 0.25), 0 0 0 1px hsl(var(--border) / 0.4)',
      }}
    >
      {/* Subtle top gradient line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(262 83% 58% / 0.6), transparent)' }}
      />

      {/* Header */}
      <div className="mb-8 space-y-1 text-center">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-sora)' }}
        >
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your MailZen workspace
        </p>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* OAuth buttons */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="group flex h-10 items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-background/60 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-muted/60 hover:shadow-md"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
            <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
            <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
            <path d="M12.0004 24C15.2404 24 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.25 12.0004 19.25C8.8704 19.25 6.21537 17.14 5.2654 14.295L1.27539 17.39C3.25539 21.31 7.3104 24 12.0004 24Z" fill="#34A853" />
          </svg>
          Google
        </button>
        <button
          type="button"
          disabled
          className="flex h-10 items-center justify-center gap-2.5 rounded-xl border border-border/40 bg-background/40 text-sm font-medium text-muted-foreground/60 cursor-not-allowed"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path d="M21.3545 0H2.64545C1.18636 0 0 1.18636 0 2.64545V21.3545C0 22.8136 1.18636 24 2.64545 24H21.3545C22.8136 24 24 22.8136 24 21.3545V2.64545C24 1.18636 22.8136 0 21.3545 0Z" fill="#0078D4" />
            <path d="M11.9999 5.33336C14.2045 5.33336 15.9999 7.12882 15.9999 9.33336V10.6667H17.9999V9.33336C17.9999 6.02421 15.3091 3.33336 11.9999 3.33336C8.69076 3.33336 5.99991 6.02421 5.99991 9.33336V10.6667H7.99991V9.33336C7.99991 7.12882 9.7953 5.33336 11.9999 5.33336Z" fill="white" />
            <path d="M3.99991 10.6667H19.9999C20.7363 10.6667 21.3333 11.2637 21.3333 12V20C21.3333 20.7364 20.7363 21.3334 19.9999 21.3334H3.99991C3.26353 21.3334 2.66656 20.7364 2.66656 20V12C2.66656 11.2637 3.26353 10.6667 3.99991 10.6667Z" fill="white" />
          </svg>
          Outlook
          <span className="text-[10px] text-muted-foreground/50">soon</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative mb-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-xs text-muted-foreground/60">or continue with email</span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Email address
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      placeholder="name@company.com"
                      className="h-11 rounded-xl border-border/60 bg-muted/30 pl-10 text-sm transition-all duration-200 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground/40"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Password
                  </FormLabel>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-primary/80 transition-colors hover:text-primary"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      type="password"
                      placeholder="••••••••••"
                      className="h-11 rounded-xl border-border/60 bg-muted/30 pl-10 text-sm transition-all duration-200 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground/40"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <button
            type="submit"
            disabled={form.formState.isSubmitting || loading}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 46%))',
              boxShadow: '0 4px 16px hsl(262 83% 58% / 0.25)',
            }}
          >
            {loading ? (
              <motion.div
                className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </Form>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/register"
          className="font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Create one free
        </Link>
      </p>
    </div>
  );
}
