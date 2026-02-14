'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';

import { BackgroundGradient } from '@/components/ui/background-gradient';
import { fadeIn, fadeInUp, springPremium } from '@/lib/motion';
import { AUTH_ROUTES, MY_MAILBOXES_QUERY } from '@/modules/auth';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const routeKey = useMemo(() => pathname || 'route:unknown', [pathname]);
  const isAuthRoute = pathname?.includes('/auth') ?? false;
  const { data: mailboxData, loading: mailboxLoading, error: mailboxError } =
    useQuery(MY_MAILBOXES_QUERY, {
      fetchPolicy: 'network-only',
      skip: isAuthRoute,
    });

  const hasMailzenAlias = (mailboxData?.myMailboxes?.length ?? 0) > 0;

  useEffect(() => {
    // Debug-only log to help trace routing/transition issues later.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[MainLayout] route change', { pathname });
    }
  }, [pathname]);

  useEffect(() => {
    // Keep mobile drawer behavior predictable when route changes.
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isAuthRoute || mailboxLoading) {
      return;
    }

    if (mailboxError) {
      router.replace(AUTH_ROUTES.login);
      return;
    }

    if (!hasMailzenAlias) {
      router.replace(AUTH_ROUTES.aliasSelect);
    }
  }, [
    hasMailzenAlias,
    isAuthRoute,
    mailboxError,
    mailboxLoading,
    router,
  ]);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      // Debug-only log to help trace UI state issues later.
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[MainLayout] toggleSidebar', { prev, next });
      }
      return next;
    });
  };

  const closeSidebar = () => {
    setSidebarOpen((prev) => {
      if (!prev) return prev;
      // Debug-only log to help trace UI state issues later.
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[MainLayout] closeSidebar');
      }
      return false;
    });
  };

  // Don't render the shell on auth pages (but keep hooks unconditionally called).
  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (mailboxLoading || (!mailboxError && !hasMailzenAlias)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Checking your account setup...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <BackgroundGradient className="opacity-40" />

      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main Content */}
      <motion.div
        className="flex flex-col flex-1 overflow-hidden"
        variants={fadeIn}
        initial="hidden"
        animate="show"
      >
        <Header onToggleSidebar={toggleSidebar} />
        <motion.main className="flex-1 overflow-y-auto p-4 md:p-6 bg-transparent">
          {/* Route transitions: keep navigation feeling premium and coherent. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={routeKey}
              className="max-w-7xl mx-auto"
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -10, transition: springPremium }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.main>
      </motion.div>
    </div>
  );
};

export default MainLayout;
