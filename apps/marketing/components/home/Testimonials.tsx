'use client';

import { Star } from 'lucide-react';
import { AnimatedSection, StaggerContainer, staggerItem } from '@/components/ui/AnimatedSection';
import { motion } from 'framer-motion';

const testimonials = [
  {
    quote:
      "MailZen completely changed how our sales team handles outreach. The AI reply drafts alone save us 2 hours a day. Response times went from days to minutes.",
    name: 'Marcus Wren',
    role: 'Head of Sales',
    company: 'Meridian Growth',
    initials: 'MW',
    accent: 'hsl(262 83% 62%)',
    rating: 5,
  },
  {
    quote:
      "We manage 8 client inboxes across our agency. MailZen's unified view and workspace controls are a game-changer. I don't know how we operated without it.",
    name: 'Priya Nair',
    role: 'Founder & CEO',
    company: 'Fable Agency',
    initials: 'PN',
    accent: 'hsl(160 84% 45%)',
    rating: 5,
  },
  {
    quote:
      "The compliance and audit features convinced our legal team. We now have full visibility over all client communications, and our retention policies run automatically.",
    name: 'James Calloway',
    role: 'Operations Director',
    company: 'Apex Legal Partners',
    initials: 'JC',
    accent: 'hsl(38 92% 55%)',
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="py-24">
      <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
        {/* Header */}
        <AnimatedSection className="mb-14 space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(262_83%_72%)]">
            Customer stories
          </p>
          <h2
            className="text-3xl font-bold tracking-tight md:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Teams love MailZen
          </h2>
          <p className="mx-auto max-w-md text-base text-muted-foreground">
            From solo founders to enterprise operations teams — here&apos;s what
            they say.
          </p>
        </AnimatedSection>

        {/* Cards */}
        <StaggerContainer className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <motion.div
              key={t.name}
              variants={staggerItem}
              className="group flex flex-col justify-between rounded-2xl border border-white/[0.07] p-7 transition-all duration-300 hover:border-white/[0.12]"
              style={{ background: 'hsl(240 6% 7%)' }}
            >
              {/* Hover glow */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(circle at 30% 20%, ${t.accent}06, transparent 60%)`,
                }}
              />

              <div className="relative space-y-4">
                {/* Stars */}
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              {/* Author */}
              <div className="relative mt-6 flex items-center gap-3 border-t border-white/[0.06] pt-5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${t.accent}cc, ${t.accent}88)`,
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground/60">
                    {t.role} · {t.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
