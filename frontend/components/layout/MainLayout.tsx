'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  // Don't render the layout on auth pages
  if (pathname?.includes('/auth')) {
    return <>{children}</>;
  }

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

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Header onToggleSidebar={toggleSidebar} />
        <motion.main 
          className="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-br from-white/80 to-slate-100/80 dark:from-slate-900/80 dark:to-slate-950/80 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.5,
            type: "spring",
            stiffness: 100,
            damping: 15
          }}
        >
          <motion.div 
            className="max-w-7xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {children}
          </motion.div>
        </motion.main>
      </motion.div>
    </div>
  );
};

export default MainLayout;
