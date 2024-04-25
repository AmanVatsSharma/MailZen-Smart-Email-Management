'use client';

import { motion } from 'framer-motion';
import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-4 px-6 flex justify-between items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="flex items-center gap-2">
            <motion.div 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 text-white font-bold"
              whileHover={{ 
                scale: 1.05,
                boxShadow: "0 0 15px rgba(124, 58, 237, 0.5)"
              }}
            >
              M
            </motion.div>
            <motion.span 
              className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              MailZen
            </motion.span>
          </Link>
        </motion.div>
        <ThemeToggle />
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-950/80 dark:to-slate-900/80">
        <div className="w-full max-w-md">
          {children}
        </div>

        {/* Floating Decoration */}
        <div className="fixed -z-10 inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-[10%] w-1/2 h-1/2 rounded-full bg-primary/5 blur-3xl transform -translate-y-1/2"></div>
          <div className="absolute bottom-0 -right-[10%] w-1/2 h-1/2 rounded-full bg-purple-500/5 blur-3xl transform translate-y-1/2"></div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 px-6 text-center text-sm text-muted-foreground">
        <div className="flex justify-center space-x-4">
          <Link href="/terms" className="hover:text-primary hover:underline">Terms</Link>
          <Link href="/privacy" className="hover:text-primary hover:underline">Privacy</Link>
          <Link href="/help" className="hover:text-primary hover:underline">Help</Link>
        </div>
        <div className="mt-2">
          &copy; {new Date().getFullYear()} MailZen. All rights reserved.
        </div>
      </footer>
    </div>
  );
} 