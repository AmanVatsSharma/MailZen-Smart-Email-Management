'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function CTABanner() {
  return (
    <section className="py-24">
      <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
        <AnimatedSection>
          <div
            className="relative overflow-hidden rounded-3xl p-12 text-center md:p-20"
            style={{
              background:
                'linear-gradient(145deg, hsl(262 83% 8%), hsl(240 6% 9%), hsl(262 83% 6%))',
              border: '1px solid hsl(262 83% 62% / 0.2)',
              boxShadow: '0 0 80px hsl(262 83% 62% / 0.08)',
            }}
          >
            {/* Background orb */}
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[500px] -translate-x-1/2 rounded-full opacity-30"
              style={{
                background:
                  'radial-gradient(circle, hsl(262 83% 62%) 0%, transparent 65%)',
              }}
            />
            {/* Grid */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.015]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />

            <div className="relative">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
                Get started today — it&apos;s free
              </p>
              <h2
                className="mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Ready to{' '}
                <span className="gradient-text">transform</span>
                {' '}how your team handles email?
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground">
                Join 10,000+ teams already using MailZen to move faster, respond
                smarter, and stay in control of every conversation.
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href={`${APP_URL}/auth/register`}
                  className="inline-flex h-12 items-center gap-2 rounded-xl px-8 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 glow-primary"
                  style={{
                    background:
                      'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 48%))',
                  }}
                >
                  Create free workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-8 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-white/[0.07]"
                >
                  Talk to sales
                </Link>
              </div>

              <p className="mt-5 text-xs text-muted-foreground/50">
                No credit card · Free to start · Cancel anytime
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
