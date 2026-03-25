'use client';

import {
  Mail,
  Zap,
  ShieldCheck,
  BarChart3,
  Workflow,
  Users,
  Bot,
  Bell,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedSection, StaggerContainer, staggerItem } from '@/components/ui/AnimatedSection';

const features = [
  {
    icon: Mail,
    title: 'Unified inbox',
    description:
      'Connect Gmail and Outlook into one intelligent workspace. No tab-switching, no missed context.',
    accent: 'hsl(262 83% 62%)',
    span: 'lg:col-span-2',
    wide: true,
  },
  {
    icon: Bot,
    title: 'AI-powered replies',
    description:
      'Generate smart draft responses in seconds. Review, tweak, and send — your team moves 3× faster.',
    accent: 'hsl(262 83% 72%)',
    span: 'lg:col-span-1',
    wide: false,
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise controls',
    description:
      'Audit logs, retention policies, legal export workflows, and admin-grade security baked in.',
    accent: 'hsl(160 84% 45%)',
    span: 'lg:col-span-1',
    wide: false,
  },
  {
    icon: Workflow,
    title: 'Smart automation',
    description:
      'Route, tag, and triage email automatically. Build rules based on sender, content, or domain.',
    accent: 'hsl(200 84% 55%)',
    span: 'lg:col-span-1',
    wide: false,
  },
  {
    icon: BarChart3,
    title: 'Team analytics',
    description:
      'Response times, open rates, engagement trends. Surface the data that improves performance.',
    accent: 'hsl(38 92% 55%)',
    span: 'lg:col-span-2',
    wide: true,
  },
  {
    icon: Bell,
    title: 'Real-time alerts',
    description:
      'Sync incidents and operational health notifications so you catch issues before customers do.',
    accent: 'hsl(340 82% 60%)',
    span: 'lg:col-span-1',
    wide: false,
  },
];

export function Features() {
  return (
    <section className="py-24">
      <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
        {/* Header */}
        <AnimatedSection className="mb-14 space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
            Platform features
          </p>
          <h2
            className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Everything your team needs
          </h2>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            One platform handles the full email lifecycle — from ingestion and triage
            to response, analytics, and audit.
          </p>
        </AnimatedSection>

        {/* Bento grid */}
        <StaggerContainer className="grid gap-3 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={staggerItem}
                className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] p-6 transition-all duration-300 hover:border-white/[0.12] ${feature.span}`}
                style={{ background: 'hsl(240 6% 7%)' }}
              >
                {/* Hover glow */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 30% 20%, ${feature.accent}10 0%, transparent 60%)`,
                  }}
                />

                <div className="relative">
                  <div
                    className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: `${feature.accent}18`,
                      border: `1px solid ${feature.accent}30`,
                    }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: feature.accent }}
                    />
                  </div>

                  <h3
                    className="mb-2 text-base font-semibold text-foreground"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>

                  {feature.wide && (
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-medium transition-colors group-hover:text-foreground"
                      style={{ color: feature.accent }}
                    >
                      Learn more
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
