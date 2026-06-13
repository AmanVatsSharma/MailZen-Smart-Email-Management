'use client';

import { motion } from 'framer-motion';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/tokens/cn';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname();
  const isLoginSplit = pathname === '/auth/login';

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-background">
      {/* Animated orb background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Orb 1 — top left */}
        <div
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-50 animate-blob"
          style={{
            background:
              'radial-gradient(circle, hsl(262 83% 58% / 0.25) 0%, hsl(262 83% 58% / 0.08) 50%, transparent 70%)',
          }}
        />
        {/* Orb 2 — top right */}
        <div
          className="absolute -top-20 right-0 h-[420px] w-[420px] rounded-full opacity-40 animate-blob-delay-2"
          style={{
            background:
              'radial-gradient(circle, hsl(280 83% 65% / 0.2) 0%, hsl(280 83% 65% / 0.06) 50%, transparent 70%)',
          }}
        />
        {/* Orb 3 — center */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-20 animate-blob-delay-4"
          style={{
            background:
              'radial-gradient(circle, hsl(262 83% 58% / 0.15) 0%, transparent 65%)',
          }}
        />
        {/* Orb 4 — bottom right */}
        <div
          className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 h-[380px] w-[380px] rounded-full opacity-30 animate-blob"
          style={{
            animationDelay: '1s',
            background:
              'radial-gradient(circle, hsl(160 84% 39% / 0.18) 0%, transparent 65%)',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link href="/" className="group flex items-center gap-2.5">
            <motion.div
              className="flex h-8 w-8 items-center justify-center rounded-xl font-bold text-white text-sm transition-all duration-200 group-hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 42%))',
                boxShadow: '0 2px 10px hsl(262 83% 58% / 0.3)',
              }}
              whileHover={{
                scale: 1.05,
                boxShadow: '0 0 20px hsl(262 83% 58% / 0.5)',
              }}
            >
              M
            </motion.div>
            <motion.span
              className="font-semibold tracking-tight"
              style={{
                fontFamily: 'var(--font-sora)',
                background: 'linear-gradient(135deg, hsl(262 83% 55%), hsl(262 83% 72%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              MailZen
            </motion.span>
          </Link>
        </motion.div>
        <ThemeToggle />
      </header>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <motion.div
          className={cn('w-full', isLoginSplit ? 'max-w-6xl' : 'max-w-[420px]')}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-5 px-6 text-center">
        <div className="flex justify-center gap-5 text-xs text-muted-foreground/70">
          <Link href="/terms" className="transition-colors hover:text-muted-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-muted-foreground">
            Privacy
          </Link>
          <Link href="/security" className="transition-colors hover:text-muted-foreground">
            Security
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted-foreground/50">
          &copy; {new Date().getFullYear()} MailZen
        </p>
      </footer>
    </div>
  );
}
