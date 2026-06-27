'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Minus, ArrowRight, Zap } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { FAQ } from '@/components/home/FAQ';
import { AnimatedSection, StaggerContainer, StaggerItem } from '@/components/ui/AnimatedSection';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const plans = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    period: '/user/mo',
    description: 'For individuals getting started — connect your inbox, try AI features, no card required.',
    badge: null,
    highlighted: false,
    accent: 'hsl(215 20% 50%)',
    cta: 'Get started free',
    ctaHref: `${APP_URL}/auth/register`,
  },
  {
    name: 'Pro',
    monthlyPrice: 25,
    annualPrice: 20,
    period: '/seat/mo',
    description: 'For growing teams that need automation, AI workflows, and shared inboxes.',
    badge: 'Most popular',
    highlighted: true,
    accent: 'hsl(262 83% 62%)',
    cta: 'Start free trial',
    ctaHref: `${APP_URL}/auth/register`,
  },
  {
    name: 'Business',
    monthlyPrice: null,
    annualPrice: null,
    period: '',
    description: 'For large organizations with enterprise security, compliance, and dedicated support.',
    badge: null,
    highlighted: false,
    accent: 'hsl(160 84% 45%)',
    cta: 'Talk to sales',
    ctaHref: '/contact',
  },
];

type FeatureRow = {
  label: string;
  starter: string | boolean;
  growth: string | boolean;
  enterprise: string | boolean;
  section?: string;
};

const featureTable: FeatureRow[] = [
  { section: 'Inbox', label: '', starter: '', growth: '', enterprise: '' },
  { label: 'Email account connections', starter: 'Up to 3', growth: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Gmail & Outlook integration', starter: true, growth: true, enterprise: true },
  { label: 'Custom SMTP/IMAP support', starter: false, growth: true, enterprise: true },
  { label: '@mailzen.com aliases', starter: '1 per user', growth: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Shared team inbox', starter: false, growth: true, enterprise: true },
  { section: 'AI Features', label: '', starter: '', growth: '', enterprise: '' },
  { label: 'AI reply draft generation', starter: '50/mo', growth: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Email thread summaries', starter: true, growth: true, enterprise: true },
  { label: 'Follow-up reminders', starter: false, growth: true, enterprise: true },
  { label: 'Custom AI tone settings', starter: false, growth: true, enterprise: true },
  { section: 'Automation', label: '', starter: '', growth: '', enterprise: '' },
  { label: 'Automation engine (unlimited rules)', starter: false, growth: true, enterprise: true },
  { label: 'AI classify, summarise & draft-reply actions', starter: false, growth: true, enterprise: true },
  { label: 'Slack notifications & webhook actions', starter: false, growth: true, enterprise: true },
  { label: 'Scheduled runs (cron)', starter: false, growth: true, enterprise: true },
  { label: 'Per-run audit trail', starter: false, growth: true, enterprise: true },
  { section: 'Analytics', label: '', starter: '', growth: '', enterprise: '' },
  { label: 'Basic inbox analytics', starter: true, growth: true, enterprise: true },
  { label: 'Team performance dashboards', starter: false, growth: true, enterprise: true },
  { label: 'Custom date range reports', starter: false, growth: true, enterprise: true },
  { label: 'CSV/PDF export', starter: false, growth: true, enterprise: true },
  { section: 'Security & Compliance', label: '', starter: '', growth: '', enterprise: '' },
  { label: 'Audit logs', starter: '7-day retention', growth: '90-day retention', enterprise: 'Unlimited' },
  { label: 'Retention policies', starter: false, growth: true, enterprise: true },
  { label: 'Legal export (eDiscovery)', starter: false, growth: false, enterprise: true },
  { label: 'SSO (SAML/OIDC)', starter: false, growth: false, enterprise: true },
  { label: 'Custom access controls', starter: false, growth: true, enterprise: true },
  { section: 'Support', label: '', starter: '', growth: '', enterprise: '' },
  { label: 'Email support', starter: true, growth: true, enterprise: true },
  { label: 'Priority support', starter: false, growth: true, enterprise: true },
  { label: 'Dedicated CSM', starter: false, growth: false, enterprise: true },
  { label: 'Onboarding assistance', starter: false, growth: false, enterprise: true },
];

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-[hsl(160_84%_45%)]" />;
  }
  if (value === false) {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground/25" />;
  }
  if (value === '') return null;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-16">
          <div
            className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full opacity-20"
            style={{
              background:
                'radial-gradient(circle, hsl(262 83% 62% / 0.4) 0%, transparent 65%)',
            }}
          />
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <AnimatedSection className="mx-auto max-w-2xl space-y-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
                Pricing
              </p>
              <h1
                className="text-4xl font-bold tracking-tight md:text-5xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Simple pricing that scales with your team
              </h1>
              <p className="text-lg text-muted-foreground">
                Start free, no credit card required. Upgrade when you&apos;re ready.
              </p>

              {/* Toggle */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <span
                  className={`text-sm font-medium transition-colors ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Monthly
                </span>
                <button
                  onClick={() => setAnnual((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
                    annual ? 'bg-[hsl(262_83%_62%)]' : 'bg-white/[0.12]'
                  }`}
                  role="switch"
                  aria-checked={annual}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                      annual ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span
                  className={`text-sm font-medium transition-colors ${annual ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Annual
                </span>
                {annual && (
                  <span className="rounded-full bg-[hsl(160_84%_39%/0.15)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(160_84%_55%)] border border-[hsl(160_84%_39%/0.3)]">
                    Save 20%
                  </span>
                )}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Plan cards */}
        <section className="pb-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <StaggerContainer className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <StaggerItem
                  key={plan.name}
                  className="relative flex flex-col rounded-2xl p-7"
                  style={{
                    background: plan.highlighted
                      ? 'linear-gradient(145deg, hsl(262 83% 8%), hsl(240 6% 9%))'
                      : 'hsl(240 6% 7%)',
                    border: `1px solid ${plan.highlighted ? 'hsl(262 83% 62% / 0.35)' : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: plan.highlighted
                      ? '0 0 48px hsl(262 83% 62% / 0.1)'
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
                      {plan.monthlyPrice === 0 ? (
                        <span
                          className="text-4xl font-bold tracking-tight"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          Free
                        </span>
                      ) : plan.monthlyPrice !== null ? (
                        <>
                          <span
                            className="text-4xl font-bold tracking-tight"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            ${annual ? plan.annualPrice : plan.monthlyPrice}
                          </span>
                          <span className="text-sm text-muted-foreground">{plan.period}</span>
                        </>
                      ) : (
                        <span
                          className="text-4xl font-bold tracking-tight"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                    {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && annual && (
                      <p className="mt-0.5 text-xs text-muted-foreground/60">
                        Billed annually · save ${(plan.monthlyPrice - plan.annualPrice!) * 12}/yr
                      </p>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

                    <Link
                      href={plan.ctaHref}
                      className={`mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-px ${
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
                </StaggerItem>
              ))}
            </StaggerContainer>

            <AnimatedSection delay={0.2} className="mt-5 text-center">
              <p className="text-xs text-muted-foreground/50">
                All plans include a 14-day free trial · No credit card required
              </p>
            </AnimatedSection>
          </div>
        </section>

        {/* Feature comparison table */}
        <section className="py-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <AnimatedSection className="mb-10 text-center">
              <h2
                className="text-2xl font-bold tracking-tight md:text-3xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Full feature comparison
              </h2>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <div
                className="overflow-hidden rounded-2xl border border-white/[0.07]"
                style={{ background: 'hsl(240 6% 7%)' }}
              >
                {/* Header */}
                <div className="grid grid-cols-4 border-b border-white/[0.06] px-6 py-4">
                  <div />
                  {plans.map((plan) => (
                    <div key={plan.name} className="text-center">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: plan.highlighted ? 'hsl(262 83% 72%)' : undefined }}
                      >
                        {plan.name}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {featureTable.map((row, i) => {
                  if (row.section) {
                    return (
                      <div
                        key={`section-${i}`}
                        className="border-b border-white/[0.04] px-6 py-3"
                        style={{ background: 'hsl(240 6% 5%)' }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                          {row.section}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={row.label}
                      className="grid grid-cols-4 items-center border-b border-white/[0.04] px-6 py-3.5 transition-colors hover:bg-white/[0.02]"
                    >
                      <p className="text-sm text-muted-foreground">{row.label}</p>
                      <div className="text-center">
                        <CellValue value={row.starter} />
                      </div>
                      <div className="text-center">
                        <CellValue value={row.growth} />
                      </div>
                      <div className="text-center">
                        <CellValue value={row.enterprise} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* FAQ */}
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

