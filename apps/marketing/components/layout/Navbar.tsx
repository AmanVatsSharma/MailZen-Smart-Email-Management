'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const navLinks = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/security', label: 'Security' },
  { href: '/about', label: 'About' },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white transition-all duration-300 group-hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 46%))',
          boxShadow: '0 0 20px hsl(262 83% 62% / 0.4)',
        }}
      >
        M
      </div>
      <span
        className="text-lg font-semibold tracking-tight text-foreground"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        MailZen
      </span>
    </Link>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-500',
          scrolled
            ? 'border-b border-white/[0.06] bg-[hsl(240_6%_4%/0.85)] backdrop-blur-2xl'
            : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 md:px-8">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative rounded-lg px-3.5 py-2 text-sm transition-colors duration-200',
                  pathname === link.href
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {pathname === link.href && (
                  <span
                    className="absolute inset-0 rounded-lg bg-white/[0.06]"
                    style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
                  />
                )}
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-1 md:flex">
            <ThemeToggle />
            <Link
              href={`${APP_URL}/auth/login`}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href={`${APP_URL}/auth/register`}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-px glow-primary"
              style={{
                background: 'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 48%))',
              }}
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[hsl(240_6%_4%)] pt-16 md:hidden">
          <nav className="flex flex-col gap-1 p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-xl px-4 py-3 text-base font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-white/[0.08] text-foreground'
                    : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 pb-1">
              <span className="text-sm font-medium text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
            <Link
              href={`${APP_URL}/auth/login`}
              className="flex w-full items-center justify-center rounded-xl border border-white/[0.1] px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06]"
            >
              Sign in
            </Link>
            <Link
              href={`${APP_URL}/auth/register`}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white glow-primary"
              style={{
                background: 'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 48%))',
              }}
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {/* Beta badge */}
          <div className="flex items-center gap-2 px-4 pt-2 pb-6">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(262_83%_62%/0.25)] bg-[hsl(262_83%_62%/0.08)] px-3 py-1 text-xs font-medium text-[hsl(262_83%_72%)]">
              <Zap className="h-3 w-3" />
              AI-powered · Now in beta
            </div>
          </div>
        </div>
      )}
    </>
  );
}
