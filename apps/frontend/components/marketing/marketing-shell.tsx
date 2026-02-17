'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type MarketingShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
};

const topNavigationLinks: Array<{ href: string; label: string }> = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/security', label: 'Security' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const footerProductLinks: Array<{ href: string; label: string }> = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/integrations', label: 'Integrations' },
];

const footerTrustLinks: Array<{ href: string; label: string }> = [
  { href: '/security', label: 'Security' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

export function MarketingShell({
  title,
  description,
  children,
  ctaLabel = 'Start free',
  ctaHref = '/auth/register',
}: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight">
            MailZen
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            {topNavigationLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/register">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border/60 bg-gradient-to-b from-primary/10 to-transparent">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              AI-powered business inbox
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
              {title}
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              {description}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/login">Open dashboard</Link>
              </Button>
            </div>
          </div>
        </section>
        <section className="mx-auto w-full max-w-6xl px-6 py-12">{children}</section>
      </main>

      <footer className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-3">
          <div className="space-y-3">
            <p className="font-semibold">MailZen</p>
            <p className="text-sm text-muted-foreground">
              Unified inbox, AI assistance, and business-ready controls for
              teams that move fast.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Product</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {footerProductLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Trust</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {footerTrustLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
