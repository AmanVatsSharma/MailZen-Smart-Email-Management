'use client';

import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

const companies = [
  'Stripe',
  'Notion',
  'Linear',
  'Vercel',
  'Figma',
  'Loom',
  'Intercom',
  'Segment',
];

const stats = [
  { value: '10k+', label: 'Teams using MailZen' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '3×', label: 'Faster response time' },
  { value: '<2 min', label: 'Setup time' },
];

export function SocialProof() {
  return (
    <section className="relative py-16">
      {/* Divider line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
        {/* Trusted by */}
        <AnimatedSection className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/40">
            Trusted by teams at
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {companies.map((company, i) => (
              <motion.span
                key={company}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
                className="text-sm font-semibold tracking-wide text-muted-foreground/30 transition-colors hover:text-muted-foreground/60"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {company}
              </motion.span>
            ))}
          </div>
        </AnimatedSection>

        {/* Stats grid */}
        <AnimatedSection delay={0.2} className="mt-14">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] md:grid-cols-4"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            {stats.map((stat, i) => (
              <div
                key={stat.value}
                className="flex flex-col items-center gap-1 px-6 py-8 text-center"
                style={{ background: 'hsl(240 6% 6%)' }}
              >
                <span
                  className="text-3xl font-bold tracking-tight md:text-4xl"
                  style={{
                    fontFamily: 'var(--font-display)',
                    background:
                      'linear-gradient(135deg, hsl(262 83% 72%) 0%, hsl(160 84% 55%) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {stat.value}
                </span>
                <span className="text-xs font-medium text-muted-foreground/60">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
