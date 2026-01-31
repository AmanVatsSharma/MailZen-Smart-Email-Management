'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';

import { BackgroundGradient } from '@/components/ui/background-gradient';
import { fadeIn, fadeInUp, springPremium } from '@/lib/motion';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const routeKey = useMemo(() => pathname || 'route:unknown', [pathname]);
  const isAuthRoute = pathname?.includes('/auth') ?? false;

  useEffect(() => {
    // Debug-only log to help trace routing/transition issues later.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[MainLayout] route change', { pathname });
    }
  }, [pathname]);

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

  return (
    <div className="flex h-screen overflow-hidden relative">
      <BackgroundGradient className="opacity-40" />
      
      {/* Mobile backdrop (click to close). Keeps interaction crisp and predictable on small screens. */}
      <AnimatePresence>
        {sidebarOpen ? (
          <motion.button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
          />
        ) : null}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      </AnimatePresence>

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
