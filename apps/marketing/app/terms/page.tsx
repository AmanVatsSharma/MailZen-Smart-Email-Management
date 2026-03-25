import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'MailZen Terms of Service — the agreement governing your use of MailZen.',
};

const sections = [
  {
    id: 'acceptance',
    title: 'Acceptance of terms',
    content: [
      {
        subtitle: 'Agreement',
        text: 'By creating a MailZen account or using any MailZen service, you agree to these Terms of Service. If you are using MailZen on behalf of an organization, you represent that you have the authority to bind that organization to these terms.',
      },
      {
        subtitle: 'Age requirement',
        text: 'You must be at least 18 years old to use MailZen. By using the service, you represent that you meet this requirement.',
      },
    ],
  },
  {
    id: 'service',
    title: 'The service',
    content: [
      {
        subtitle: 'Description',
        text: 'MailZen provides email management software including unified inbox, AI-assisted reply generation, automation, analytics, and team collaboration tools.',
      },
      {
        subtitle: 'Service availability',
        text: 'We aim for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance, emergency patches, and third-party outages may affect availability.',
      },
      {
        subtitle: 'Changes to the service',
        text: 'We may modify or discontinue features with reasonable notice. Material changes that negatively impact your use will be communicated at least 30 days in advance.',
      },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts & workspaces',
    content: [
      {
        subtitle: 'Account responsibility',
        text: 'You are responsible for maintaining the security of your account credentials, all activity that occurs under your account, and compliance with these terms by all users in your workspace.',
      },
      {
        subtitle: 'Workspace data',
        text: 'Workspace administrators have authority to manage members, data, and settings within their workspace. Individual members may have their access modified or removed by admins.',
      },
      {
        subtitle: 'Connected accounts',
        text: 'When you connect Gmail or Outlook accounts, you authorize MailZen to access and manage those accounts on your behalf within the scope you define.',
      },
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    content: [
      {
        subtitle: 'Permitted use',
        text: 'MailZen may be used for legitimate business email management, team communication, and workflows consistent with the intended purpose of the service.',
      },
      {
        subtitle: 'Prohibited activities',
        text: 'You may not use MailZen for spam or unsolicited bulk email, phishing or fraud, circumventing security controls, scraping email data for resale, or any activity that violates applicable law or email provider policies.',
      },
      {
        subtitle: 'AI usage',
        text: 'AI-generated content must be reviewed before sending. You are responsible for all communications sent from connected accounts, regardless of whether they were drafted by AI.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & payment',
    content: [
      {
        subtitle: 'Subscription',
        text: 'Paid plans are billed monthly or annually in advance. Prices are per user per month unless otherwise stated.',
      },
      {
        subtitle: 'Trials',
        text: 'Free trials are provided without obligation. At the end of a trial, access may be limited unless a paid plan is activated.',
      },
      {
        subtitle: 'Cancellation',
        text: 'You may cancel your subscription at any time. Access continues until the end of your billing period. No refunds are provided for unused portions of paid periods, except where required by law.',
      },
      {
        subtitle: 'Enterprise pricing',
        text: 'Enterprise contracts are governed by the applicable order form and commercial agreement, which may supersede these general billing terms.',
      },
    ],
  },
  {
    id: 'ip',
    title: 'Intellectual property',
    content: [
      {
        subtitle: 'Your data',
        text: 'You own your email data, workspace content, and communications. MailZen does not claim ownership of any content you process through the service.',
      },
      {
        subtitle: 'MailZen IP',
        text: 'MailZen owns the platform software, brand, and product features. You may not copy, reverse-engineer, or resell any part of the MailZen platform.',
      },
      {
        subtitle: 'Feedback',
        text: 'Feedback and suggestions you provide may be used by MailZen without obligation to you.',
      },
    ],
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    content: [
      {
        subtitle: 'No warranty',
        text: 'MailZen is provided "as is" without warranties of any kind, express or implied, including fitness for a particular purpose.',
      },
      {
        subtitle: 'Liability cap',
        text: 'MailZen\'s total liability to you for any claims arising out of these terms shall not exceed the amounts paid by you in the 12 months preceding the claim.',
      },
      {
        subtitle: 'Exclusions',
        text: 'We are not liable for indirect, incidental, or consequential damages, including lost profits or data, arising from your use of the service.',
      },
    ],
  },
  {
    id: 'termination',
    title: 'Termination',
    content: [
      {
        subtitle: 'By you',
        text: 'You may terminate your account at any time from workspace settings. Your data will be retained for 30 days before deletion.',
      },
      {
        subtitle: 'By MailZen',
        text: 'We may suspend or terminate accounts that violate these terms, with or without notice depending on the severity of the violation.',
      },
    ],
  },
  {
    id: 'governing-law',
    title: 'Governing law & disputes',
    content: [
      {
        subtitle: 'Governing law',
        text: 'These terms are governed by the laws of the jurisdiction in which MailZen is incorporated, without regard to conflict of law principles.',
      },
      {
        subtitle: 'Disputes',
        text: 'Disputes should first be raised with our support team. If unresolved, disputes will be handled through binding arbitration unless you opt out within 30 days of account creation.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    content: [
      {
        subtitle: 'Questions',
        text: 'For questions about these terms, contact legal@mailzen.com.',
      },
      {
        subtitle: 'Last updated',
        text: 'These terms were last updated in March 2026.',
      },
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <section className="relative overflow-hidden pt-32 pb-24">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
              {/* Sidebar */}
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
                    Terms of Service
                  </h1>
                  <p className="text-sm text-muted-foreground/60">Last updated: March 2026</p>
                  <p className="pt-2 text-base text-muted-foreground">
                    These terms govern your use of the MailZen platform and services.
                    Please read them carefully before using MailZen.
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
                    This summary is provided for informational purposes. The governing
                    legal agreement between your organization and MailZen is the signed
                    order form and any applicable enterprise agreements. For legal
                    questions, contact{' '}
                    <a
                      href="mailto:legal@mailzen.com"
                      className="text-[hsl(262_83%_72%)] underline underline-offset-4"
                    >
                      legal@mailzen.com
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
