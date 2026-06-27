import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CTABanner } from '@/components/home/CTABanner';
import { AnimatedSection, StaggerContainer, StaggerItem } from '@/components/ui/AnimatedSection';

export const metadata: Metadata = {
  title: 'About',
  description: 'The story behind MailZen — why we built it and who we built it for.',
};

const values = [
  {
    title: 'Speed matters',
    description:
      'Every feature we build is designed to make your team faster. Not just marginally — measurably, noticeably faster.',
    accent: 'hsl(262 83% 62%)',
  },
  {
    title: 'Visibility is power',
    description:
      'You can\'t improve what you can\'t see. We build observability into every layer — from inbox analytics to audit logs.',
    accent: 'hsl(160 84% 45%)',
  },
  {
    title: 'AI assists, humans decide',
    description:
      'Our AI generates and suggests. Your team reviews and approves. We believe AI should augment human judgment, not replace it.',
    accent: 'hsl(200 84% 55%)',
  },
  {
    title: 'Built for scale',
    description:
      "MailZen works for a team of two today, and is ready for a team of 2,000 tomorrow. We don't cut corners on architecture.",
    accent: 'hsl(38 92% 55%)',
  },
];

const milestones = [
  { year: '2023', event: 'MailZen founded with a simple idea: email should work for teams, not against them.' },
  { year: 'Q1 2024', event: 'First version launched with Gmail integration and basic inbox unification.' },
  { year: 'Q3 2024', event: 'AI reply generation and Outlook support added. 1,000 teams onboarded.' },
  { year: 'Q1 2025', event: 'Smart automation, analytics dashboards, and compliance tools shipped.' },
  { year: '2025', event: 'Enterprise features, SSO, and legal export tools in development. 10,000+ teams.' },
];

const audiences = [
  {
    who: 'Founders',
    what: 'Stay on top of investor, customer, and partner conversations without drowning in your inbox.',
    accent: 'hsl(262 83% 62%)',
  },
  {
    who: 'Sales teams',
    what: 'Respond to leads faster, track follow-ups automatically, and hit quota without dropping threads.',
    accent: 'hsl(38 92% 55%)',
  },
  {
    who: 'Agencies',
    what: 'Manage communication for multiple clients from one workspace, with full context and history.',
    accent: 'hsl(200 84% 55%)',
  },
  {
    who: 'Operations',
    what: 'Automate routing, enforce SLAs, and run compliance workflows at any scale.',
    accent: 'hsl(160 84% 45%)',
  },
  {
    who: 'Legal teams',
    what: 'Maintain audit trails, enforce retention policies, and export communications for discovery.',
    accent: 'hsl(340 82% 60%)',
  },
  {
    who: 'Customer success',
    what: 'Respond faster, retain more customers, and never let a follow-up fall through the cracks.',
    accent: 'hsl(262 83% 72%)',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-20">
          <div
            className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full opacity-20"
            style={{
              background:
                'radial-gradient(circle, hsl(262 83% 62% / 0.4) 0%, transparent 65%)',
            }}
          />
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <AnimatedSection className="mx-auto max-w-3xl space-y-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
                About MailZen
              </p>
              <h1
                className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                We built MailZen because{' '}
                <span className="gradient-text">email was broken</span>
                {' '}for teams
              </h1>
              <p className="text-lg text-muted-foreground">
                Most email tools were built for individuals. When teams started relying on
                email for business-critical communication, chaos followed. MailZen is our
                answer to that chaos.
              </p>
            </AnimatedSection>
          </div>
        </section>

        {/* Mission statement */}
        <section className="pb-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <AnimatedSection>
              <div
                className="relative overflow-hidden rounded-3xl p-10 md:p-16"
                style={{
                  background: 'hsl(240 6% 7%)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div
                  className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full opacity-20"
                  style={{
                    background: 'radial-gradient(circle, hsl(262 83% 62%), transparent)',
                  }}
                />
                <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
                      Our mission
                    </p>
                    <h2
                      className="text-2xl font-bold tracking-tight md:text-3xl"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Give every team the inbox they deserve
                    </h2>
                  </div>
                  <p className="text-base leading-relaxed text-muted-foreground">
                    Business email should be fast, organized, auditable, and collaborative.
                    We combine AI assistance with team-grade controls to give businesses the
                    operational leverage they need — without replacing the human judgment
                    that matters most.
                  </p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Values */}
        <section className="py-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <AnimatedSection className="mb-10 text-center">
              <h2
                className="text-2xl font-bold tracking-tight md:text-3xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                What drives us
              </h2>
            </AnimatedSection>
            <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((value) => (
                <StaggerItem
                  key={value.title}
                  className="rounded-2xl border border-white/[0.07] p-6"
                  style={{ background: 'hsl(240 6% 7%)' }}
                >
                  <div
                    className="mb-3 h-1 w-8 rounded-full"
                    style={{ background: value.accent }}
                  />
                  <h3
                    className="mb-2 text-base font-semibold"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {value.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {value.description}
                  </p>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16">
          <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
            <AnimatedSection className="mb-10 text-center">
              <h2
                className="text-2xl font-bold tracking-tight md:text-3xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Our journey
              </h2>
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <div className="space-y-0">
                {milestones.map((m, i) => (
                  <div key={m.year} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          background: 'linear-gradient(135deg, hsl(262 83% 62% / 0.2), hsl(262 83% 62% / 0.1))',
                          border: '1px solid hsl(262 83% 62% / 0.3)',
                          color: 'hsl(262 83% 72%)',
                        }}
                      >
                        {i + 1}
                      </div>
                      {i < milestones.length - 1 && (
                        <div className="mt-1 h-full w-px bg-white/[0.06]" style={{ minHeight: '32px' }} />
                      )}
                    </div>
                    <div className="pb-8">
                      <p
                        className="mb-1 text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]"
                      >
                        {m.year}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{m.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Who we serve */}
        <section className="py-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <AnimatedSection className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
                Who we serve
              </p>
              <h2
                className="text-2xl font-bold tracking-tight md:text-3xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Teams that live in email
              </h2>
            </AnimatedSection>
            <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {audiences.map((a) => (
                <StaggerItem
                  key={a.who}
                  className="flex items-start gap-4 rounded-2xl border border-white/[0.07] p-5"
                  style={{ background: 'hsl(240 6% 7%)' }}
                >
                  <div
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: a.accent }}
                  />
                  <div>
                    <p className="mb-1 text-sm font-semibold" style={{ color: a.accent }}>
                      {a.who}
                    </p>
                    <p className="text-sm text-muted-foreground">{a.what}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
