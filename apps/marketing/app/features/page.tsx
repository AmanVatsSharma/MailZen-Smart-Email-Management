import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Mail,
  Bot,
  ShieldCheck,
  BarChart3,
  Workflow,
  Users,
  Bell,
  Fingerprint,
  Download,
  Globe,
  Zap,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CTABanner } from '@/components/home/CTABanner';
import { AnimatedSection, StaggerContainer, staggerItem } from '@/components/ui/AnimatedSection';
import { motion } from 'framer-motion';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore every feature in MailZen — unified inbox, AI reply generation, smart automation, team analytics, compliance tools, and more.',
};

const featureSections = [
  {
    tag: 'Core inbox',
    icon: Mail,
    title: 'One inbox for all your accounts',
    description:
      'Connect Gmail and Outlook accounts and manage every conversation from a single unified workspace. No tab-switching, no context loss, no missed messages. MailZen keeps every thread organized, searchable, and collaborative.',
    accent: 'hsl(262 83% 62%)',
    items: [
      'Gmail + Outlook OAuth integration',
      'Unified priority view across all accounts',
      'Thread search and filtering',
      'Shared inbox for team collaboration',
      '@mailzen.com alias creation',
      'Custom SMTP/IMAP support',
    ],
  },
  {
    tag: 'AI assistant',
    icon: Bot,
    title: 'AI that helps you move faster',
    description:
      'Our AI scans incoming emails, generates contextual summaries, and drafts replies that match your tone and context. Review, tweak, and send — your team moves 3× faster without losing the human touch.',
    accent: 'hsl(262 83% 72%)',
    items: [
      'Contextual reply draft generation',
      'Email thread summarization',
      'Follow-up reminders and suggestions',
      'Tone and context-aware responses',
      'One-click reply approval workflow',
      'AI action audit trail',
    ],
  },
  {
    tag: 'Automation',
    icon: Workflow,
    title: 'Smart rules, zero code',
    description:
      'Build automation rules that route, tag, and triage email based on sender, content, domain, or custom signals — without writing a single line of code. Your inbox works for you, not the other way around.',
    accent: 'hsl(200 84% 55%)',
    items: [
      'Visual rule builder',
      'Sender and content-based routing',
      'Auto-labeling and prioritization',
      'Escalation rules for SLA compliance',
      'Scheduled automation runs',
      'Webhook triggers for external systems',
    ],
  },
  {
    tag: 'Analytics',
    icon: BarChart3,
    title: 'Insights that improve your team',
    description:
      'Track open rates, response times, engagement trends, and team performance metrics. Surface patterns that help your team continuously improve — from solo founders to large ops teams.',
    accent: 'hsl(38 92% 55%)',
    items: [
      'Response time tracking',
      'Email open and click rates',
      'Team-level performance dashboards',
      'Conversation trend analysis',
      'Export reports as CSV/PDF',
      'Custom date range filtering',
    ],
  },
  {
    tag: 'Security & compliance',
    icon: ShieldCheck,
    title: 'Enterprise-grade controls',
    description:
      'MailZen is built with security-first architecture. Audit logs, retention policies, role-based access, and legal export tools ensure your communications are compliant and fully governed.',
    accent: 'hsl(160 84% 45%)',
    items: [
      'Role-based access controls',
      'Immutable audit logs',
      'Configurable retention policies',
      'Legal export for eDiscovery',
      'Admin-only operation gating',
      'Fault-tolerant audit writes',
    ],
  },
  {
    tag: 'Team workspace',
    icon: Users,
    title: 'Built for how teams work',
    description:
      'Workspaces let your whole team collaborate on email without chaos. Assign emails, share context, set roles, and scale from a team of 2 to an enterprise with thousands of conversations per day.',
    accent: 'hsl(340 82% 60%)',
    items: [
      'Multi-member workspaces',
      'Email assignment and ownership',
      'Internal notes on threads',
      'Role definitions (admin, member, viewer)',
      'Workspace-level billing controls',
      'Onboarding and invite management',
    ],
  },
];

const quickFeatures = [
  { icon: Bell, label: 'Real-time alerts' },
  { icon: Fingerprint, label: 'SSO support' },
  { icon: Download, label: 'Data export' },
  { icon: Globe, label: 'Multi-provider' },
  { icon: Zap, label: 'Instant sync' },
];

export default function FeaturesPage() {
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
            <AnimatedSection className="mx-auto max-w-3xl space-y-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
                Platform features
              </p>
              <h1
                className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Everything you need to{' '}
                <span className="gradient-text">run email as a system</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                One platform for inbox management, AI productivity, team collaboration,
                and enterprise compliance.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {quickFeatures.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </span>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Feature sections — alternating layout */}
        <section className="py-8">
          <div className="mx-auto w-full max-w-7xl space-y-6 px-5 md:px-8">
            {featureSections.map((section, i) => {
              const Icon = section.icon;
              const isEven = i % 2 === 0;
              return (
                <AnimatedSection key={section.tag} delay={0.05}>
                  <div
                    className={`grid gap-8 overflow-hidden rounded-2xl border border-white/[0.07] p-8 md:grid-cols-2 md:items-center md:gap-16 md:p-12 ${
                      isEven ? '' : 'md:[&>*:first-child]:order-2'
                    }`}
                    style={{ background: 'hsl(240 6% 7%)' }}
                  >
                    {/* Text side */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{
                            background: `${section.accent}15`,
                            border: `1px solid ${section.accent}30`,
                          }}
                        >
                          <Icon className="h-5 w-5" style={{ color: section.accent }} />
                        </div>
                        <span
                          className="text-xs font-semibold uppercase tracking-widest"
                          style={{ color: section.accent }}
                        >
                          {section.tag}
                        </span>
                      </div>
                      <h2
                        className="text-2xl font-bold tracking-tight md:text-3xl"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {section.title}
                      </h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {section.description}
                      </p>
                      <Link
                        href={`/contact`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80"
                        style={{ color: section.accent }}
                      >
                        Learn more <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {/* Feature list */}
                    <div>
                      <ul className="grid gap-2.5 sm:grid-cols-2">
                        {section.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0"
                              style={{ color: section.accent }}
                            />
                            <span className="text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </section>

        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
