import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'MailZen Privacy Policy — how we collect, use, and protect your data.',
};

const sections = [
  {
    id: 'data-collection',
    title: 'Data we collect',
    content: [
      {
        subtitle: 'Account data',
        text: 'When you create a MailZen account, we collect your name, email address, and workspace information. This is required to provide the service.',
      },
      {
        subtitle: 'Email data',
        text: 'When you connect Gmail or Outlook accounts, MailZen accesses your email messages, contacts, and labels to provide inbox management features. We process this data on your behalf.',
      },
      {
        subtitle: 'Usage data',
        text: 'We collect anonymized usage analytics including feature interactions, performance metrics, and error logs. This helps us improve the product.',
      },
      {
        subtitle: 'Billing data',
        text: 'Payment information is handled by our payment processor and is not stored on MailZen servers.',
      },
    ],
  },
  {
    id: 'data-use',
    title: 'How we use your data',
    content: [
      {
        subtitle: 'Service delivery',
        text: 'Your data is processed to provide the features you request — inbox sync, AI reply generation, analytics, and automation rules.',
      },
      {
        subtitle: 'AI features',
        text: 'Email content is processed by our AI models to generate reply suggestions and summaries. This processing is done in-context and is not used to train general models without consent.',
      },
      {
        subtitle: 'Product improvement',
        text: 'Aggregated, anonymized usage data helps us understand how features are used and where to focus development effort.',
      },
      {
        subtitle: 'Communications',
        text: 'We may send you product updates, security notices, and account-related emails. You can manage notification preferences in your workspace settings.',
      },
    ],
  },
  {
    id: 'data-sharing',
    title: 'Data sharing & third parties',
    content: [
      {
        subtitle: 'No sale of data',
        text: 'We do not sell, rent, or trade your personal data or email content to any third party.',
      },
      {
        subtitle: 'Infrastructure providers',
        text: 'We use trusted cloud infrastructure providers (subject to data processing agreements) to operate the service.',
      },
      {
        subtitle: 'Legal requirements',
        text: 'We may disclose data when required by law, court order, or to protect the rights and safety of MailZen and its users.',
      },
    ],
  },
  {
    id: 'data-rights',
    title: 'Your rights',
    content: [
      {
        subtitle: 'Access and portability',
        text: 'You can export your data at any time from workspace settings. Enterprise plans include admin-grade export tools.',
      },
      {
        subtitle: 'Deletion',
        text: 'You can delete your account and associated data. Upon deletion, we purge your data per our retention schedule (typically 30 days).',
      },
      {
        subtitle: 'Correction',
        text: 'You can update your profile, workspace settings, and connected accounts at any time.',
      },
      {
        subtitle: 'GDPR',
        text: 'For users in the EU/EEA, you have additional rights under GDPR including the right to object to processing. Contact privacy@mailzen.com for data requests.',
      },
    ],
  },
  {
    id: 'retention',
    title: 'Data retention',
    content: [
      {
        subtitle: 'Active accounts',
        text: 'Data is retained for the duration of your account and service agreement.',
      },
      {
        subtitle: 'After cancellation',
        text: 'Upon account cancellation, data is retained for 30 days before deletion, unless a legal hold or custom retention policy is in place.',
      },
      {
        subtitle: 'Enterprise retention',
        text: 'Enterprise plans can configure custom retention periods and legal hold workflows via the admin dashboard.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    content: [
      {
        subtitle: 'Encryption',
        text: 'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Access credentials are never stored in plaintext.',
      },
      {
        subtitle: 'Access controls',
        text: 'Internal access to customer data is role-gated, logged, and audited. Only authorized personnel with a legitimate business need can access customer data.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact & updates',
    content: [
      {
        subtitle: 'Privacy questions',
        text: 'For privacy-related questions or GDPR data requests, contact privacy@mailzen.com.',
      },
      {
        subtitle: 'Policy updates',
        text: 'We will notify you of material changes to this policy via email and in-app notification at least 30 days before they take effect.',
      },
      {
        subtitle: 'Last updated',
        text: 'This policy was last updated in March 2026.',
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <section className="relative overflow-hidden pt-32 pb-24">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
              {/* Sidebar navigation */}
              <AnimatedSection direction="left" className="hidden lg:block">
                <div className="sticky top-24 space-y-1">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                    On this page
                  </p>
                  {sections.map((s) => (
                    <Link
                      key={s.id}
                      href={`#${s.id}`}
                      className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
                    >
                      {s.title}
                    </Link>
                  ))}
                </div>
              </AnimatedSection>

              {/* Content */}
              <AnimatedSection>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
                    Legal
                  </p>
                  <h1
                    className="text-3xl font-bold tracking-tight md:text-4xl"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Privacy Policy
                  </h1>
                  <p className="text-sm text-muted-foreground/60">
                    Last updated: March 2026
                  </p>
                  <p className="pt-2 text-base text-muted-foreground">
                    MailZen is committed to protecting your privacy and handling your
                    data with transparency and care. This policy explains what data we
                    collect, how we use it, and your rights.
                  </p>
                </div>

                <div className="mt-10 space-y-12">
                  {sections.map((section) => (
                    <div key={section.id} id={section.id} className="scroll-mt-24">
                      <h2
                        className="mb-6 border-b border-white/[0.06] pb-3 text-xl font-bold"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {section.title}
                      </h2>
                      <div className="space-y-6">
                        {section.content.map((item) => (
                          <div key={item.subtitle}>
                            <h3 className="mb-1.5 text-sm font-semibold text-foreground">
                              {item.subtitle}
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  className="mt-12 rounded-xl border border-white/[0.07] p-5"
                  style={{ background: 'hsl(240 6% 7%)' }}
                >
                  <p className="text-xs text-muted-foreground/60">
                    This is a summary document and not legal advice. For legal data
                    processing agreements, DPAs, or formal compliance inquiries, contact{' '}
                    <a
                      href="mailto:privacy@mailzen.com"
                      className="text-[hsl(262_83%_72%)] underline underline-offset-4"
                    >
                      privacy@mailzen.com
                    </a>
                    .
                  </p>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
