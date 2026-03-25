'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { AnimatedSection } from '@/components/ui/AnimatedSection';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    q: 'How does MailZen connect to Gmail and Outlook?',
    a: 'MailZen uses official OAuth integrations for both Gmail and Outlook. You authorize the connection from within your workspace settings — no passwords shared, no third-party forwarding rules required.',
  },
  {
    q: 'Is my email data secure?',
    a: 'Yes. MailZen uses JWT-backed authentication, role-based access controls, and encrypts data at rest and in transit. Enterprise customers get additional compliance controls, audit logging, and configurable retention policies.',
  },
  {
    q: 'How does the AI reply generation work?',
    a: "Our AI analyzes the email thread context and generates a contextually relevant draft reply. You always review and approve before sending — the AI assists, it doesn't act autonomously.",
  },
  {
    q: 'Can I use MailZen for my whole team?',
    a: 'Absolutely. MailZen is built for teams. You can create shared workspaces, assign roles, set access controls, and collaborate on email threads without forwarding chains or CC storms.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export all your data before cancellation. We provide admin-grade export tools for emails, contacts, and audit logs. After cancellation, data is deleted per our retention policy.',
  },
  {
    q: 'Does MailZen work with custom email domains?',
    a: 'Yes. In addition to Gmail and Outlook, MailZen supports custom SMTP/IMAP providers and @mailzen.com alias creation for team workflows.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — you can get started for free and explore core features before upgrading. No credit card required to sign up.',
  },
  {
    q: 'What support options are available?',
    a: 'Starter plans get standard email support. Growth plans get priority support. Enterprise plans include a dedicated Customer Success Manager and onboarding support.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-foreground"
      >
        <span
          className={`text-sm font-medium transition-colors ${open ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {q}
        </span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all"
          style={{
            background: open
              ? 'hsl(262 83% 62% / 0.15)'
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${open ? 'hsl(262 83% 62% / 0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: open ? 'hsl(262 83% 72%)' : undefined,
          }}
        >
          {open ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  return (
    <section className="py-24">
      <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
        {/* Header */}
        <AnimatedSection className="mb-12 space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
            FAQ
          </p>
          <h2
            className="text-3xl font-bold tracking-tight md:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Frequently asked questions
          </h2>
        </AnimatedSection>

        {/* Questions */}
        <AnimatedSection delay={0.1}>
          <div className="rounded-2xl border border-white/[0.07] px-6"
            style={{ background: 'hsl(240 6% 7%)' }}
          >
            {faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
