'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Menu, Bell, Search, User, LogOut, Settings } from 'lucide-react';
import { gql, useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getUserData, logoutUser } from '@/lib/auth/auth-utils';

interface HeaderProps {
  onToggleSidebar: () => void;
}

// Cookie-based logout: backend clears HttpOnly token cookie.
const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  const [logout, { loading: logoutLoading }] = useMutation(LOGOUT_MUTATION, {
    onError: (e) => {
      console.error('[Logout] GraphQL error', e);
    },
  });

  useEffect(() => {
    setMounted(true);
    // Try to get user data if available
    const userData = getUserData();
    if (userData) {
      setUser(userData);
    }
  }, []);

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user || !user.name) return 'MZ';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleLogout = async () => {
    try {
      console.log('[Logout] starting');
      // Clears HttpOnly cookie on backend (session ends server-side).
      await logout();
    } catch (e) {
      // Even if backend logout fails, clear local cache and move user to login.
      console.error('[Logout] failed (continuing with local cleanup)', e);
    } finally {
      logoutUser();
      router.push('/auth/login');
    }
  };

  return (
    <motion.header 
      // Premium glass header: slightly more blur to feel “native”.
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/65 backdrop-blur-xl px-4 md:px-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5,
        type: "spring",
        stiffness: 100,
        damping: 15
      }}
    >
      <div className="flex items-center gap-2 lg:gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleSidebar}
          className="lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-6 w-6" />
        </motion.button>
        <motion.div 
          className="hidden md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
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
              className="hidden text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent lg:inline-block"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              MailZen
            </motion.span>
          </Link>
        </motion.div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          {/* Avoid animating width to prevent layout shift; keep subtle fade/scale instead. */}
          <motion.input
            type="search"
            placeholder="Search..."
            className="rounded-full bg-background border border-input h-9 w-[200px] lg:w-[300px] pl-8 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            whileFocus={{ boxShadow: "0 0 0 3px rgba(124, 58, 237, 0.2)" }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.35 }}
          />
        </div>

        <motion.div 
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
              3
            </span>
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar || "/avatars/01.png"} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user?.name || "My Account"}</DropdownMenuLabel>
              {user?.email && (
                <p className="px-2 py-1 text-xs text-muted-foreground truncate">{user.email}</p>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{logoutLoading ? 'Logging out...' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>
    </motion.header>
  );
};

export default Header;
