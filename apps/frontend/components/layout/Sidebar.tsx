'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Mail,
  Users,
  Filter,
  Zap,
  MessageSquareText,
  Settings,
  HelpCircle,
  ChevronLeft,
  Plus,
  MailPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

const sidebarVariants = {
  open: {
    width: '240px',
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  closed: {
    width: '0px',
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();

  const mainNavItems = [
    {
      title: 'Dashboard',
      href: '/',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: 'Inbox',
      href: '/inbox',
      icon: <Mail className="h-5 w-5" />,
      badge: 12,
    },
    {
      title: 'Email Providers',
      href: '/email-providers',
      icon: <MailPlus className="h-5 w-5" />,
    },
    {
      title: 'Contacts',
      href: '/contacts',
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: 'Filters',
      href: '/filters',
      icon: <Filter className="h-5 w-5" />,
    },
    {
      title: 'Warmup',
      href: '/warmup',
      icon: <Zap className="h-5 w-5" />,
    },
    {
      title: 'Smart Replies',
      href: '/smart-replies',
      icon: <MessageSquareText className="h-5 w-5" />,
    },
  ];

  const utilityNavItems = [
    {
      title: 'Settings',
      href: '/settings',
      icon: <Settings className="h-5 w-5" />,
    },
    {
      title: 'Help & Support',
      href: '/help',
      icon: <HelpCircle className="h-5 w-5" />,
    },
  ];

  return (
    <motion.div
      className={cn(
        // Premium glass sidebar (kept rectangular for edge-to-edge shell alignment).
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-background/65 backdrop-blur-xl lg:relative',
        isOpen ? 'w-60' : 'w-0 lg:w-60'
      )}
      variants={sidebarVariants}
      initial={false}
      animate={isOpen ? 'open' : 'closed'}
    >
      <div className="flex h-16 items-center justify-between px-4 py-4">
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            MailZen
          </motion.span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-3 py-2">
        <Button variant="premium" className="w-full justify-start gap-2 shadow-lg">
          <Plus className="h-4 w-4" />
          <span>New Email</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 py-2">
        <div className="px-3 py-2">
          <div className="text-xs font-semibold text-muted-foreground pl-4 mb-2">Main</div>
          <nav className="grid gap-1">
            {mainNavItems.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.3 }}
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-all',
                    pathname === item.href
                      ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className={cn(
                      'transition-colors',
                      pathname === item.href ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    {item.icon}
                  </motion.div>
                  <span>{item.title}</span>
                  {item.badge && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </motion.div>
            ))}
          </nav>
        </div>

        <div className="px-3 py-2">
          <div className="text-xs font-semibold text-muted-foreground pl-4 mb-2">Utility</div>
          <nav className="grid gap-1">
            {utilityNavItems.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + 0.1 * index, duration: 0.3 }}
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-all',
                    pathname === item.href
                      ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className={cn(
                      'transition-colors',
                      pathname === item.href ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    {item.icon}
                  </motion.div>
                  <span>{item.title}</span>
                </Link>
              </motion.div>
            ))}
          </nav>
        </div>
      </ScrollArea>

      <div className="mt-auto p-4">
        <motion.div 
          className="rounded-lg border bg-card/50 backdrop-blur-sm p-4 shadow-sm"
          whileHover={{ y: -2, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-1">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Upgrade to Pro</p>
              <p className="text-xs text-muted-foreground">Get more features</p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Sidebar;
