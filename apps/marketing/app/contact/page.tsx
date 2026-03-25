'use client';

import { useState } from 'react';
import { Mail, MessageSquare, ShieldCheck, ArrowRight, Check } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AnimatedSection, StaggerContainer, staggerItem } from '@/components/ui/AnimatedSection';
import { motion } from 'framer-motion';

const contactOptions = [
  {
    icon: MessageSquare,
    title: 'Sales',
    description:
      'Discuss pricing, custom plans, and onboarding for your team or organization.',
    email: 'sales@mailzen.com',
    accent: 'hsl(262 83% 62%)',
    cta: 'Contact sales',
  },
  {
    icon: Mail,
    title: 'Support',
    description:
      'Get help with setup, integrations, troubleshooting, and workspace configuration.',
    email: 'support@mailzen.com',
    accent: 'hsl(160 84% 45%)',
    cta: 'Get support',
  },
  {
    icon: ShieldCheck,
    title: 'Security',
    description:
      'For security disclosures, trust reviews, compliance queries, and data processing questions.',
    email: 'security@mailzen.com',
    accent: 'hsl(200 84% 55%)',
    cta: 'Contact security',
  },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: 'sales',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

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
            <AnimatedSection className="mx-auto max-w-2xl space-y-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
                Contact us
              </p>
              <h1
                className="text-4xl font-bold tracking-tight md:text-5xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Let&apos;s plan your MailZen rollout
              </h1>
              <p className="text-lg text-muted-foreground">
                Whether you&apos;re evaluating or ready to onboard your team, we&apos;ll
                help you move quickly.
              </p>
            </AnimatedSection>
          </div>
        </section>

        {/* Contact options */}
        <section className="pb-12">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <StaggerContainer className="grid gap-4 md:grid-cols-3">
              {contactOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <motion.div
                    key={option.title}
                    variants={staggerItem}
                    className="group rounded-2xl border border-white/[0.07] p-6 transition-all duration-300 hover:border-white/[0.12]"
                    style={{ background: 'hsl(240 6% 7%)' }}
                  >
                    <div
                      className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        background: `${option.accent}15`,
                        border: `1px solid ${option.accent}30`,
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: option.accent }} />
                    </div>
                    <h3
                      className="mb-2 text-base font-semibold"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {option.title}
                    </h3>
                    <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                      {option.description}
                    </p>
                    <a
                      href={`mailto:${option.email}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: option.accent }}
                    >
                      {option.email}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </motion.div>
                );
              })}
            </StaggerContainer>
          </div>
        </section>

        {/* Contact form */}
        <section className="py-12 pb-24">
          <div className="mx-auto w-full max-w-2xl px-5 md:px-8">
            <AnimatedSection>
              <div
                className="rounded-2xl border border-white/[0.07] p-8"
                style={{ background: 'hsl(240 6% 7%)' }}
              >
                {submitted ? (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full"
                      style={{
                        background: 'hsl(160 84% 39% / 0.15)',
                        border: '1px solid hsl(160 84% 39% / 0.3)',
                      }}
                    >
                      <Check className="h-7 w-7 text-[hsl(160_84%_55%)]" />
                    </div>
                    <h3
                      className="text-xl font-bold"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Message sent!
                    </h3>
                    <p className="text-muted-foreground">
                      Thanks for reaching out. We&apos;ll get back to you within one
                      business day.
                    </p>
                  </div>
                ) : (
                  <>
                    <h2
                      className="mb-6 text-xl font-bold"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Send us a message
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Name *
                          </label>
                          <input
                            required
                            value={formData.name}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, name: e.target.value }))
                            }
                            placeholder="Jane Smith"
                            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none transition-colors focus:border-[hsl(262_83%_62%/0.5)] focus:ring-1 focus:ring-[hsl(262_83%_62%/0.25)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Email *
                          </label>
                          <input
                            required
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, email: e.target.value }))
                            }
                            placeholder="jane@company.com"
                            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none transition-colors focus:border-[hsl(262_83%_62%/0.5)] focus:ring-1 focus:ring-[hsl(262_83%_62%/0.25)]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Company
                        </label>
                        <input
                          value={formData.company}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, company: e.target.value }))
                          }
                          placeholder="Acme Corp"
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none transition-colors focus:border-[hsl(262_83%_62%/0.5)] focus:ring-1 focus:ring-[hsl(262_83%_62%/0.25)]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Subject *
                        </label>
                        <select
                          required
                          value={formData.subject}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, subject: e.target.value }))
                          }
                          className="w-full rounded-xl border border-white/[0.08] bg-[hsl(240_6%_9%)] px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-[hsl(262_83%_62%/0.5)]"
                        >
                          <option value="sales">Sales inquiry</option>
                          <option value="support">Technical support</option>
                          <option value="security">Security & compliance</option>
                          <option value="partnership">Partnership</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Message *
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={formData.message}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, message: e.target.value }))
                          }
                          placeholder="Tell us about your team and what you're looking for..."
                          className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none transition-colors focus:border-[hsl(262_83%_62%/0.5)] focus:ring-1 focus:ring-[hsl(262_83%_62%/0.25)]"
                        />
                      </div>

                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 glow-primary"
                        style={{
                          background:
                            'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 48%))',
                        }}
                      >
                        Send message
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      <p className="text-center text-xs text-muted-foreground/50">
                        We respond within one business day.
                      </p>
                    </form>
                  </>
                )}
              </div>
            </AnimatedSection>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
