'use client';

import Link from 'next/link';
import { Check, ArrowRight, Zap } from 'lucide-react';
import { AnimatedSection, StaggerContainer, staggerItem } from '@/components/ui/AnimatedSection';
import { motion } from 'framer-motion';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const plans = [
  {
    name: 'Starter',
    price: '$19',
    period: '/user/mo',
    description: 'Perfect for small teams getting started.',
    features: [
      'Unified inbox (up to 3 accounts)',
      'AI summaries & reply drafts',
      'Basic workspace & analytics',
      'Email notification alerts',
      'Standard support',
    ],
    cta: 'Get started',
    ctaHref: `${APP_URL}/auth/register`,
    highlighted: false,
    accent: 'hsl(215 20% 40%)',
  },
  {
    name: 'Growth',
    price: '$49',
    period: '/user/mo',
    description: 'For teams that need speed and control.',
    features: [
      'Unlimited account connections',
      'Advanced AI reply generation',
      'Smart automation rules',
      'Priority alerts & observability',
      'Admin exports & compliance tools',
      'Priority support',
    ],
    cta: 'Start free trial',
    ctaHref: `${APP_URL}/auth/register`,
    highlighted: true,
    badge: 'Most popular',
    accent: 'hsl(262 83% 62%)',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large orgs with complex requirements.',
    features: [
      'Everything in Growth',
      'Custom security & compliance',
      'SSO & advanced access controls',
      'Dedicated onboarding & CSM',
      'Volume pricing & SLAs',
      'Custom integrations',
    ],
    cta: 'Talk to sales',
    ctaHref: '/contact',
    highlighted: false,
    accent: 'hsl(160 84% 45%)',
  },
];

export function PricingPreview() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 100% 60% at 50% 100%, hsl(262 83% 62% / 0.06), transparent)',
        }}
      />

      <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
        {/* Header */}
        <AnimatedSection className="mb-14 space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
            Pricing
          </p>
          <h2
            className="text-3xl font-bold tracking-tight md:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Simple, transparent pricing
          </h2>
          <p className="mx-auto max-w-md text-base text-muted-foreground">
            Start free, scale when you&apos;re ready. No hidden fees, no locked features.
          </p>
        </AnimatedSection>

        {/* Plans */}
        <StaggerContainer className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={staggerItem}
              className={`relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${
                plan.highlighted
                  ? 'border-[hsl(262_83%_62%/0.4)]'
                  : 'border-white/[0.07] hover:border-white/[0.12]'
              }`}
              style={{
                background: plan.highlighted
                  ? 'linear-gradient(145deg, hsl(262 83% 8%), hsl(240 6% 9%))'
                  : 'hsl(240 6% 7%)',
                border: `1px solid ${plan.highlighted ? 'hsl(262 83% 62% / 0.35)' : 'rgba(255,255,255,0.07)'}`,
                boxShadow: plan.highlighted
                  ? '0 0 40px hsl(262 83% 62% / 0.1), 0 0 0 1px hsl(262 83% 62% / 0.2)'
                  : undefined,
              }}
            >
              {plan.highlighted && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 0%, hsl(262 83% 62% / 0.08), transparent 60%)',
                  }}
                />
              )}

              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold text-white"
                    style={{
                      background: 'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 48%))',
                      boxShadow: '0 0 16px hsl(262 83% 62% / 0.4)',
                    }}
                  >
                    <Zap className="h-2.5 w-2.5" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="relative flex flex-1 flex-col">
                <p
                  className="text-sm font-semibold"
                  style={{ color: plan.accent }}
                >
                  {plan.name}
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span
                    className="text-4xl font-bold tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{plan.description}</p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: plan.highlighted ? 'hsl(262 83% 72%)' : 'hsl(160 84% 45%)' }}
                      />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-px ${
                    plan.highlighted
                      ? 'text-white glow-primary'
                      : 'border border-white/[0.1] bg-white/[0.04] text-foreground hover:bg-white/[0.07]'
                  }`}
                  style={
                    plan.highlighted
                      ? {
                          background:
                            'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 48%))',
                        }
                      : undefined
                  }
                >
                  {plan.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          ))}
        </StaggerContainer>

        {/* Pricing page link */}
        <AnimatedSection delay={0.3} className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground/60 underline decoration-muted-foreground/20 underline-offset-4 transition-colors hover:text-muted-foreground"
          >
            View full pricing details & feature comparison →
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
