import type { Metadata } from 'next';
import { ShieldCheck, Lock, Eye, FileText, Server, RefreshCw, Check } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CTABanner } from '@/components/home/CTABanner';
import { AnimatedSection, StaggerContainer, StaggerItem } from '@/components/ui/AnimatedSection';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How MailZen protects your business communications with enterprise-grade security, compliance, and governance controls.',
};

const pillars = [
  {
    icon: Lock,
    title: 'Authentication & access',
    description:
      'JWT-backed session management with short-lived tokens. Role-based access controls ensure sensitive operations — billing, exports, admin actions — are gated to authorized users only.',
    accent: 'hsl(262 83% 62%)',
    points: [
      'OAuth 2.0 for Gmail and Outlook',
      'JWT with automatic rotation',
      'Role-based access controls (RBAC)',
      'Admin-only operation enforcement',
      'SSO via SAML/OIDC (Enterprise)',
    ],
  },
  {
    icon: Eye,
    title: 'Audit logging',
    description:
      'Every sensitive action in MailZen is recorded — admin operations, data exports, policy changes, and access events. Logs are immutable, structured for querying, and designed for compliance.',
    accent: 'hsl(200 84% 55%)',
    points: [
      'Immutable action audit trail',
      'Structured JSON log format',
      'User, timestamp, and IP tracking',
      'Non-blocking async audit writes',
      'Compliance-ready log retention',
    ],
  },
  {
    icon: FileText,
    title: 'Data governance',
    description:
      "Configure how long data is retained and when it's purged. Support legal holds, eDiscovery exports, and regulatory retention requirements — from GDPR to industry-specific compliance.",
    accent: 'hsl(160 84% 45%)',
    points: [
      'Configurable retention policies',
      'Automated data purge workflows',
      'Legal export for eDiscovery',
      'GDPR-aligned data handling',
      'Workspace-scoped data isolation',
    ],
  },
  {
    icon: Server,
    title: 'Infrastructure security',
    description:
      'MailZen runs on isolated, hardened infrastructure with network segmentation, encrypted secrets management, and continuous vulnerability scanning.',
    accent: 'hsl(38 92% 55%)',
    points: [
      'Encryption at rest and in transit',
      'Isolated per-tenant data storage',
      'Secrets management via vault',
      'Regular security scanning',
      'Infrastructure-as-code with audit',
    ],
  },
  {
    icon: RefreshCw,
    title: 'Reliability & resilience',
    description:
      'Critical workflows are designed to fail gracefully. Audit writes are non-blocking, sync jobs have automatic retry, and operational health is continuously monitored.',
    accent: 'hsl(340 82% 60%)',
    points: [
      '99.9% uptime SLA',
      'Non-blocking audit writes',
      'Automatic retry and backoff',
      'Graceful degradation patterns',
      'Real-time status monitoring',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Compliance readiness',
    description:
      'Built for regulated industries. MailZen supports the controls and audit visibility required by teams in legal, finance, healthcare, and government-adjacent sectors.',
    accent: 'hsl(262 83% 72%)',
    points: [
      'GDPR-aligned data processing',
      'Legal hold and litigation support',
      'Export for eDiscovery requests',
      'Custom DPA on Enterprise plans',
      'Security review documentation',
    ],
  },
];

const certifications = [
  { label: 'TLS 1.3', desc: 'In-transit encryption' },
  { label: 'AES-256', desc: 'At-rest encryption' },
  { label: 'OAuth 2.0', desc: 'Auth standard' },
  { label: 'RBAC', desc: 'Access control' },
  { label: 'GDPR', desc: 'Data compliance' },
  { label: '99.9% SLA', desc: 'Uptime guarantee' },
];

export default function SecurityPage() {
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
                Security & compliance
              </p>
              <h1
                className="text-4xl font-bold tracking-tight md:text-5xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Built for businesses that{' '}
                <span className="gradient-text">can&apos;t afford mistakes</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                MailZen is designed with enterprise security, compliance workflows, and
                operational trust as core requirements — not afterthoughts.
              </p>
            </AnimatedSection>

            {/* Trust badges */}
            <AnimatedSection delay={0.2} className="mt-12">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] sm:grid-cols-3 lg:grid-cols-6"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {certifications.map((cert) => (
                  <div
                    key={cert.label}
                    className="flex flex-col items-center justify-center gap-1 px-4 py-5 text-center"
                    style={{ background: 'hsl(240 6% 7%)' }}
                  >
                    <span
                      className="text-lg font-bold tracking-tight"
                      style={{
                        fontFamily: 'var(--font-display)',
                        background: 'linear-gradient(135deg, hsl(262 83% 72%), hsl(160 84% 55%))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {cert.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">{cert.desc}</span>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Security pillars */}
        <section className="pb-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <StaggerItem
                    key={pillar.title}
                    className="group relative rounded-2xl border border-white/[0.07] p-6 transition-all duration-300 hover:border-white/[0.12]"
                    style={{ background: 'hsl(240 6% 7%)' }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background: `radial-gradient(circle at 30% 20%, ${pillar.accent}08, transparent 60%)`,
                      }}
                    />

                    <div className="relative">
                      <div
                        className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                        style={{
                          background: `${pillar.accent}15`,
                          border: `1px solid ${pillar.accent}30`,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: pillar.accent }} />
                      </div>
                      <h3
                        className="mb-2.5 text-base font-semibold"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {pillar.title}
                      </h3>
                      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                        {pillar.description}
                      </p>
                      <ul className="space-y-1.5">
                        {pillar.points.map((point) => (
                          <li key={point} className="flex items-center gap-2 text-xs text-muted-foreground/70">
                            <Check className="h-3 w-3 shrink-0" style={{ color: pillar.accent }} />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </div>
        </section>

        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}

