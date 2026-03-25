'use client';

import { AnimatedSection, StaggerContainer, staggerItem } from '@/components/ui/AnimatedSection';
import { motion } from 'framer-motion';
import { Plug, Bot, BarChart3 } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Plug,
    title: 'Connect your accounts',
    description:
      'Link Gmail and Outlook with one click. MailZen syncs your inbox instantly — no forwarding rules, no complex setup.',
    accent: 'hsl(262 83% 62%)',
    duration: '< 2 minutes',
  },
  {
    number: '02',
    icon: Bot,
    title: 'Let AI triage and draft',
    description:
      'Our AI scans incoming emails, surfaces high-priority items, and generates contextual draft replies ready for your review.',
    accent: 'hsl(160 84% 45%)',
    duration: 'Instant',
  },
  {
    number: '03',
    icon: BarChart3,
    title: 'Move faster, track everything',
    description:
      'Reply 3× faster with AI assistance. Track team response times, open rates, and conversation history — all in one place.',
    accent: 'hsl(38 92% 55%)',
    duration: 'Every day',
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background texture */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, hsl(262 83% 62% / 0.05), transparent)',
        }}
      />

      <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
        {/* Header */}
        <AnimatedSection className="mb-16 space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
            How it works
          </p>
          <h2
            className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Up and running{' '}
            <span className="gradient-text">in minutes</span>
          </h2>
          <p className="mx-auto max-w-lg text-base text-muted-foreground">
            No migration headaches. No IT tickets. Connect, configure, and start
            shipping faster email from day one.
          </p>
        </AnimatedSection>

        {/* Steps */}
        <StaggerContainer className="relative grid gap-6 md:grid-cols-3">
          {/* Connecting line */}
          <div className="pointer-events-none absolute top-12 left-1/2 hidden h-px w-2/3 -translate-x-1/2 md:block"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(262 83% 62% / 0.3), hsl(160 84% 45% / 0.3), transparent)',
            }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={staggerItem}
                className="group relative rounded-2xl border border-white/[0.07] p-7 transition-all duration-300 hover:border-white/[0.12]"
                style={{ background: 'hsl(240 6% 7%)' }}
              >
                {/* Hover glow */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 20% 20%, ${step.accent}08, transparent 60%)`,
                  }}
                />

                {/* Step number */}
                <div className="mb-5 flex items-center justify-between">
                  <span
                    className="text-4xl font-bold tracking-tighter opacity-20"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: step.accent,
                    }}
                  >
                    {step.number}
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      borderColor: `${step.accent}40`,
                      color: step.accent,
                      background: `${step.accent}12`,
                    }}
                  >
                    {step.duration}
                  </span>
                </div>

                {/* Icon */}
                <div
                  className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    background: `${step.accent}15`,
                    border: `1px solid ${step.accent}30`,
                  }}
                >
                  <Icon className="h-6 w-6" style={{ color: step.accent }} />
                </div>

                <h3
                  className="mb-2.5 text-base font-semibold text-foreground"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
