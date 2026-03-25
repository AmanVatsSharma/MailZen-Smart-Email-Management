import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CTABanner } from '@/components/home/CTABanner';
import { AnimatedSection, StaggerContainer, staggerItem } from '@/components/ui/AnimatedSection';
import { motion } from 'framer-motion';

export const metadata: Metadata = {
  title: 'Integrations',
  description:
    'Connect MailZen with Gmail, Outlook, SMTP providers, and your existing business tools.',
};

const integrations = [
  {
    name: 'Gmail',
    category: 'Email provider',
    description:
      'Connect Google Workspace or personal Gmail accounts via secure OAuth. Full inbox sync, label management, and send-as support.',
    status: 'live',
    accent: 'hsl(4 90% 58%)',
    icon: 'G',
  },
  {
    name: 'Outlook',
    category: 'Email provider',
    description:
      'Connect Microsoft 365 and Outlook.com accounts. Support for Exchange Online, calendar signals, and contact sync.',
    status: 'live',
    accent: 'hsl(214 100% 49%)',
    icon: 'O',
  },
  {
    name: 'Custom SMTP / IMAP',
    category: 'Email provider',
    description:
      'Use any email provider via standard SMTP/IMAP protocols. Ideal for teams with custom mail infrastructure.',
    status: 'live',
    accent: 'hsl(262 83% 62%)',
    icon: '✉',
  },
  {
    name: '@mailzen.com Aliases',
    category: 'Aliases',
    description:
      'Create dedicated @mailzen.com email addresses for teams, projects, or workflows — managed inside workspaces.',
    status: 'live',
    accent: 'hsl(160 84% 45%)',
    icon: '@',
  },
  {
    name: 'Webhook Triggers',
    category: 'Automation',
    description:
      'Send outbound webhooks on email events — received, replied, tagged — to trigger actions in external systems.',
    status: 'live',
    accent: 'hsl(38 92% 55%)',
    icon: '⚡',
  },
  {
    name: 'Slack',
    category: 'Notifications',
    description:
      'Get real-time Slack notifications when high-priority emails arrive or SLAs are at risk.',
    status: 'coming-soon',
    accent: 'hsl(360 60% 55%)',
    icon: 'S',
  },
  {
    name: 'HubSpot',
    category: 'CRM',
    description:
      'Sync email threads with HubSpot contacts and deals. Log conversations automatically.',
    status: 'coming-soon',
    accent: 'hsl(18 90% 55%)',
    icon: 'H',
  },
  {
    name: 'Salesforce',
    category: 'CRM',
    description:
      'Connect email activity to Salesforce records. Auto-log emails, contacts, and follow-up tasks.',
    status: 'coming-soon',
    accent: 'hsl(200 84% 50%)',
    icon: 'SF',
  },
  {
    name: 'Zapier',
    category: 'Automation',
    description:
      'Connect MailZen to 5,000+ apps through Zapier workflows. No-code automation for any email event.',
    status: 'coming-soon',
    accent: 'hsl(16 90% 55%)',
    icon: 'Z',
  },
];

const categories = ['All', 'Email provider', 'Aliases', 'Automation', 'Notifications', 'CRM'];

export default function IntegrationsPage() {
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
                Integrations
              </p>
              <h1
                className="text-4xl font-bold tracking-tight md:text-5xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Connect your entire email stack
              </h1>
              <p className="text-lg text-muted-foreground">
                MailZen works with the tools your team already uses. Start with Gmail or
                Outlook, then expand your workflow as you grow.
              </p>
            </AnimatedSection>
          </div>
        </section>

        {/* Integration cards */}
        <section className="pb-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration) => (
                <motion.div
                  key={integration.name}
                  variants={staggerItem}
                  className="group relative flex flex-col rounded-2xl border border-white/[0.07] p-6 transition-all duration-300 hover:border-white/[0.12]"
                  style={{ background: 'hsl(240 6% 7%)' }}
                >
                  {/* Hover glow */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(circle at 30% 20%, ${integration.accent}08, transparent 60%)`,
                    }}
                  />

                  <div className="relative flex flex-1 flex-col">
                    {/* Icon + status */}
                    <div className="mb-4 flex items-start justify-between">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${integration.accent}cc, ${integration.accent}88)`,
                        }}
                      >
                        {integration.icon}
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={
                          integration.status === 'live'
                            ? {
                                background: 'hsl(160 84% 39% / 0.15)',
                                color: 'hsl(160 84% 55%)',
                                border: '1px solid hsl(160 84% 39% / 0.3)',
                              }
                            : {
                                background: 'rgba(255,255,255,0.05)',
                                color: 'hsl(215 16% 55%)',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }
                        }
                      >
                        {integration.status === 'live' ? '● Live' : '◌ Coming soon'}
                      </span>
                    </div>

                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      {integration.category}
                    </p>
                    <h3
                      className="mb-2 text-base font-semibold text-foreground"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {integration.name}
                    </h3>
                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                      {integration.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </StaggerContainer>

            <AnimatedSection delay={0.3} className="mt-12 text-center">
              <p className="text-sm text-muted-foreground/60">
                Need a custom integration?{' '}
                <Link
                  href="/contact"
                  className="font-medium text-[hsl(262_83%_72%)] underline underline-offset-4 transition-opacity hover:opacity-80"
                >
                  Contact our team →
                </Link>
              </p>
            </AnimatedSection>
          </div>
        </section>

        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
