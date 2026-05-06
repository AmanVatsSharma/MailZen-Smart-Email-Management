/**
 * File:        apps/marketing/components/home/AutomationsSection.tsx
 * Module:      Marketing · Home · Automations feature section
 * Purpose:     Dedicated landing section showcasing the MailZen Automation Engine —
 *              three demo scenario cards, key capability bullets, and design-partner quotes.
 *
 * Exports:
 *   - AutomationsSection  — React server-side component (no interactivity needed)
 *
 * Depends on:
 *   - framer-motion                   — scroll-triggered entrance animations
 *   - AnimatedSection / StaggerContainer — existing animation primitives
 *   - lucide-react                    — icons
 *
 * Side-effects: none
 *
 * Key invariants:
 *   - Matches existing dark-card visual language (hsl(240 6% 7%), border-white/[0.07])
 *   - Demo scenario cards use a "play" placeholder since video URLs aren't finalized yet
 *   - Design-partner quotes are illustrative placeholders until real partners onboard
 *
 * Read order:
 *   1. demoscenarios array — the 3 use-case cards
 *   2. partnerQuotes array — 2 design-partner testimonials
 *   3. AutomationsSection — component render
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

'use client';

import { Zap, Tag, UserCheck, Bell, Play, ArrowRight, Quote } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection, StaggerContainer, staggerItem } from '@/components/ui/AnimatedSection';

const demoScenarios = [
  {
    icon: Tag,
    title: 'Auto-label urgent emails',
    description:
      'When an email arrives from your top clients, MailZen instantly labels it "Urgent", moves it to the top of your queue, and notifies the right team member — before anyone opens their laptop.',
    accent: 'hsl(262 83% 62%)',
    trigger: 'email.received',
    steps: ['Label → "Urgent"', 'Notify team member', 'Pin to inbox top'],
  },
  {
    icon: UserCheck,
    title: 'Smart round-robin assignment',
    description:
      'Support requests route automatically to the next available team member. No manual triage, no bottlenecks. Escalate to a senior rep when the SLA window narrows.',
    accent: 'hsl(200 84% 55%)',
    trigger: 'email.received',
    steps: ['Assign → round-robin', 'Set SLA timer', 'Escalate on breach'],
  },
  {
    icon: Bell,
    title: 'AI classify + notify',
    description:
      'MailZen\'s AI reads each inbound email, classifies it as "Contract", "Complaint", "Upsell", or "Support", then routes it to the right workflow — with full audit trail.',
    accent: 'hsl(160 84% 45%)',
    trigger: 'email.received',
    steps: ['AI classify', 'Route by category', 'Log audit trail'],
  },
];

const partnerQuotes = [
  {
    quote:
      'We replaced three Zapier workflows with one MailZen automation. It fires in under 2 seconds, the audit trail is right there in the app, and it just works — no brittle webhook glue.',
    name: 'Sofia Brennan',
    role: 'Head of Customer Operations',
    company: 'Northbridge SaaS',
    initials: 'SB',
    accent: 'hsl(262 83% 62%)',
  },
  {
    quote:
      'The auto-assign rule we built in 15 minutes handles 200+ inbound leads a day. Our response SLA went from 4 hours to 22 minutes. The design-partner program got us this before it shipped publicly.',
    name: 'Tariq Hassan',
    role: 'Founder',
    company: 'GrowthLoop',
    initials: 'TH',
    accent: 'hsl(200 84% 55%)',
  },
];

const capabilities = [
  'Trigger on email received, assigned, replied, or on a cron schedule',
  'Boolean condition trees — match sender, subject, domain, label, and more',
  'Sequential action steps with per-step retry and audit log',
  'AI classify, summarize, and draft-reply as native automation actions',
  'Slack notifications and outbound webhooks with HMAC signing',
  'Per-workspace concurrency cap, loop detection, and kill switch',
];

export function AutomationsSection() {
  return (
    <section className="py-28 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-10"
        style={{
          background:
            'radial-gradient(ellipse, hsl(262 83% 62% / 0.5) 0%, transparent 65%)',
        }}
      />

      <div className="mx-auto w-full max-w-7xl px-5 md:px-8 relative">
        {/* Header */}
        <AnimatedSection className="mx-auto mb-16 max-w-2xl space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(262_83%_62%)/20] bg-[hsl(262_83%_62%)/8] px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 text-[hsl(262_83%_72%)]" />
            <span className="text-xs font-semibold text-[hsl(262_83%_72%)]">
              Automation Engine · Pro+
            </span>
          </div>
          <h2
            className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Your inbox on{' '}
            <span className="gradient-text">autopilot</span>
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            Build &ldquo;when X happens, do Y&rdquo; workflows across your entire email stack —
            without writing code. Powered by the same AI that drives your inbox.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(262_83%_62%)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Join design partner program <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              See all features
            </Link>
          </div>
        </AnimatedSection>

        {/* Demo scenario cards */}
        <StaggerContainer className="mb-16 grid gap-4 md:grid-cols-3">
          {demoScenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <motion.div
                key={scenario.title}
                variants={staggerItem}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] transition-all duration-300 hover:border-white/[0.12]"
                style={{ background: 'hsl(240 6% 7%)' }}
              >
                {/* Hover glow */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 30% 0%, ${scenario.accent}08, transparent 55%)`,
                  }}
                />

                {/* Video placeholder */}
                <div
                  className="relative flex h-44 items-center justify-center border-b border-white/[0.05]"
                  style={{
                    background: `linear-gradient(135deg, ${scenario.accent}0c 0%, hsl(240 6% 5%) 100%)`,
                  }}
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: `${scenario.accent}20`,
                      border: `1px solid ${scenario.accent}40`,
                    }}
                  >
                    <Play
                      className="ml-0.5 h-5 w-5"
                      style={{ color: scenario.accent }}
                    />
                  </div>
                  <span
                    className="absolute bottom-3 right-4 text-[10px] font-medium uppercase tracking-widest opacity-40"
                    style={{ color: scenario.accent }}
                  >
                    Demo coming soon
                  </span>
                </div>

                {/* Content */}
                <div className="relative flex flex-1 flex-col p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        background: `${scenario.accent}15`,
                        border: `1px solid ${scenario.accent}25`,
                      }}
                    >
                      <Icon className="h-4 w-4" style={{ color: scenario.accent }} />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {scenario.title}
                    </h3>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {scenario.description}
                  </p>

                  {/* Steps pill trail */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {scenario.steps.map((step, i) => (
                      <span
                        key={step}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
                        style={{
                          background: `${scenario.accent}12`,
                          color: scenario.accent,
                          border: `1px solid ${scenario.accent}20`,
                        }}
                      >
                        <span
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
                          style={{ background: `${scenario.accent}25` }}
                        >
                          {i + 1}
                        </span>
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </StaggerContainer>

        {/* Capabilities + partner quotes side-by-side */}
        <AnimatedSection delay={0.1}>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Capabilities */}
            <div
              className="rounded-2xl border border-white/[0.07] p-8 space-y-5"
              style={{ background: 'hsl(240 6% 7%)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background: 'hsl(262 83% 62% / 0.12)',
                    border: '1px solid hsl(262 83% 62% / 0.25)',
                  }}
                >
                  <Zap className="h-4 w-4 text-[hsl(262_83%_62%)]" />
                </div>
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  What the engine can do
                </h3>
              </div>
              <ul className="space-y-3">
                {capabilities.map((cap) => (
                  <li key={cap} className="flex items-start gap-2.5 text-sm">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: 'hsl(262 83% 62%)' }}
                    />
                    <span className="text-muted-foreground">{cap}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Partner quotes */}
            <div className="space-y-4">
              {partnerQuotes.map((q) => (
                <div
                  key={q.name}
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.07] p-6 transition-all duration-300 hover:border-white/[0.12]"
                  style={{ background: 'hsl(240 6% 7%)' }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(circle at 80% 80%, ${q.accent}06, transparent 60%)`,
                    }}
                  />
                  <div className="relative space-y-3">
                    <Quote className="h-4 w-4 opacity-30" style={{ color: q.accent }} />
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {q.quote}
                    </p>
                  </div>
                  <div className="relative mt-5 flex items-center gap-3 border-t border-white/[0.06] pt-4">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${q.accent}cc, ${q.accent}88)`,
                      }}
                    >
                      {q.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{q.name}</p>
                      <p className="text-xs text-muted-foreground/60">
                        {q.role} · {q.company}
                      </p>
                    </div>
                    <span
                      className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold"
                      style={{
                        background: `${q.accent}12`,
                        color: q.accent,
                        border: `1px solid ${q.accent}20`,
                      }}
                    >
                      Design partner
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
