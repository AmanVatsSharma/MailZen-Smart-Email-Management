'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/auth-utils';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if the user is authenticated
    if (isAuthenticated()) {
      // Redirect to dashboard if authenticated
      router.push('/dashboard');
    } else {
      // Redirect to login if not authenticated
      router.push('/auth/login');
    }
  }, [router]);

  // Return a loading state while redirecting
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-950/80 dark:to-slate-900/80">
      <div className="animate-pulse flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 text-white text-3xl font-bold">
          M
        </div>
        <div className="mt-4 text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          MailZen
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
} 