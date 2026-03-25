'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Zap,
  Mail,
  Star,
  Bot,
  CheckCircle,
  Inbox,
  Reply,
} from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function InboxMockup() {
  const emails = [
    {
      from: 'Sarah Chen',
      subject: 'Q4 Partnership Proposal',
      preview: 'Hi, following up on our conversation...',
      time: '2m ago',
      unread: true,
      tag: 'Sales',
      tagColor: 'hsl(262 83% 62%)',
    },
    {
      from: 'David Kim',
      subject: 'Re: Product roadmap review',
      preview: 'The timeline looks good. I think we should...',
      time: '18m ago',
      unread: true,
      tag: 'Internal',
      tagColor: 'hsl(160 84% 39%)',
    },
    {
      from: 'Acme Corp',
      subject: 'Contract renewal — action needed',
      preview: 'Your subscription is up for renewal on...',
      time: '1h ago',
      unread: false,
      tag: 'Billing',
      tagColor: 'hsl(38 92% 50%)',
    },
    {
      from: 'Emma Rodriguez',
      subject: 'Onboarding feedback',
      preview: 'Just wanted to share some thoughts on...',
      time: '3h ago',
      unread: false,
      tag: 'Support',
      tagColor: 'hsl(200 84% 50%)',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 48, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="animate-float relative mx-auto w-full max-w-2xl"
    >
      {/* Glow behind the mockup */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-3xl opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 50%, hsl(262 83% 62% / 0.25), transparent)',
        }}
      />

      {/* Card */}
      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{
          background: 'hsl(240 6% 7%)',
          borderColor: 'rgba(255,255,255,0.08)',
          boxShadow:
            '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          <div className="ml-3 flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/50">MailZen — Unified Inbox</span>
          </div>
          {/* AI badge top right */}
          <div className="ml-auto flex items-center gap-1 rounded-full border border-[hsl(262_83%_62%/0.3)] bg-[hsl(262_83%_62%/0.1)] px-2 py-0.5">
            <Bot className="h-3 w-3 text-[hsl(262_83%_72%)]" />
            <span className="text-[10px] font-medium text-[hsl(262_83%_72%)]">AI Active</span>
          </div>
        </div>

        {/* Email list */}
        <div className="divide-y divide-white/[0.04]">
          {emails.map((email, i) => (
            <motion.div
              key={email.subject}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.7 + i * 0.08 }}
              className="group flex cursor-default items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
            >
              {/* Avatar */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{
                  background: `linear-gradient(135deg, ${email.tagColor}99, ${email.tagColor}66)`,
                }}
              >
                {email.from
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${email.unread ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {email.from}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground/50">
                    {email.time}
                  </span>
                </div>
                <p
                  className={`truncate text-[11px] ${email.unread ? 'font-medium text-foreground/80' : 'text-muted-foreground'}`}
                >
                  {email.subject}
                </p>
                <p className="truncate text-[10px] text-muted-foreground/50">
                  {email.preview}
                </p>
              </div>

              {/* Tag */}
              <span
                className="ml-1 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                style={{
                  background: `${email.tagColor}22`,
                  color: email.tagColor,
                  border: `1px solid ${email.tagColor}40`,
                }}
              >
                {email.tag}
              </span>
            </motion.div>
          ))}
        </div>

        {/* AI reply suggestion bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="border-t border-white/[0.06] px-4 py-3"
        >
          <div className="flex items-center gap-2 rounded-xl border border-[hsl(262_83%_62%/0.2)] bg-[hsl(262_83%_62%/0.06)] px-3 py-2">
            <Bot className="h-3.5 w-3.5 shrink-0 text-[hsl(262_83%_72%)]" />
            <p className="flex-1 truncate text-[11px] text-muted-foreground/70">
              <span className="text-[hsl(262_83%_72%)] font-medium">AI suggestion:</span> &quot;Thanks
              for the proposal, Sarah. I&apos;d love to schedule a call this week...&quot;
            </p>
            <button className="flex shrink-0 items-center gap-1 rounded-lg bg-[hsl(262_83%_62%/0.2)] px-2 py-1 text-[10px] font-semibold text-[hsl(262_83%_72%)] transition-colors hover:bg-[hsl(262_83%_62%/0.3)]">
              <Reply className="h-2.5 w-2.5" />
              Use
            </button>
          </div>
        </motion.div>
      </div>

      {/* Floating stat chips */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 1.4 }}
        className="absolute -left-4 top-16 hidden rounded-xl border border-white/[0.08] bg-[hsl(240_6%_9%)] px-3 py-2 shadow-xl lg:flex items-center gap-2"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(160_84%_39%/0.15)]">
          <CheckCircle className="h-3.5 w-3.5 text-[hsl(160_84%_55%)]" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground/60">Response rate</p>
          <p className="text-sm font-bold text-foreground">3× faster</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        className="absolute -right-4 bottom-20 hidden rounded-xl border border-white/[0.08] bg-[hsl(240_6%_9%)] px-3 py-2 shadow-xl lg:flex items-center gap-2"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(262_83%_62%/0.15)]">
          <Mail className="h-3.5 w-3.5 text-[hsl(262_83%_72%)]" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground/60">Emails handled</p>
          <p className="text-sm font-bold text-foreground">10k+ today</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pt-20 pb-16 md:px-8">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="animate-blob absolute -top-40 -left-20 h-[700px] w-[700px] rounded-full opacity-30"
          style={{
            background:
              'radial-gradient(circle, hsl(262 83% 58% / 0.35) 0%, transparent 65%)',
          }}
        />
        <div
          className="animate-blob-2 absolute top-20 right-0 h-[500px] w-[500px] rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle, hsl(262 83% 70% / 0.25) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full opacity-15"
          style={{
            background:
              'radial-gradient(circle, hsl(160 84% 39% / 0.2) 0%, transparent 65%)',
          }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-5xl text-center">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mb-8 flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(262_83%_62%/0.25)] bg-[hsl(262_83%_62%/0.08)] px-4 py-1.5 text-xs font-semibold text-[hsl(262_83%_72%)] shadow-sm shadow-[hsl(262_83%_62%/0.1)]">
            <Zap className="h-3 w-3" />
            AI-powered business inbox — now in beta
            <span className="ml-1 flex h-1.5 w-1.5 rounded-full bg-[hsl(160_84%_55%)] shadow-sm shadow-[hsl(160_84%_55%/0.5)]" />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mx-auto max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-foreground md:text-6xl lg:text-7xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Your inbox.{' '}
          <span className="gradient-text">Supercharged</span>
          {' '}with AI.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl"
        >
          MailZen unifies your Gmail and Outlook accounts into one intelligent workspace.
          AI drafts replies, routes emails, and surfaces what matters — so your team
          responds faster and never drops the ball.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href={`${APP_URL}/auth/register`}
            className="inline-flex h-12 items-center gap-2 rounded-xl px-7 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 glow-primary"
            style={{
              background:
                'linear-gradient(135deg, hsl(262 83% 62%), hsl(262 83% 48%))',
            }}
          >
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/features"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-7 text-sm font-semibold text-foreground backdrop-blur-sm transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.07]"
          >
            See all features
          </Link>
        </motion.div>

        {/* Social proof micro */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground/60"
        >
          <span className="flex items-center gap-1.5">
            <span className="flex -space-x-1.5">
              {['S', 'D', 'E', 'M'].map((l, i) => (
                <span
                  key={i}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-[hsl(240_6%_12%)] text-[9px] font-bold text-white"
                  style={{
                    background: `hsl(${262 + i * 20} 83% ${52 + i * 5}%)`,
                  }}
                >
                  {l}
                </span>
              ))}
            </span>
            10,000+ teams onboarded
          </span>
          <span className="h-3 w-px bg-white/[0.1]" />
          <span className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            ))}
            4.9 / 5 rating
          </span>
          <span className="h-3 w-px bg-white/[0.1]" />
          <span>No credit card required</span>
        </motion.div>
      </div>

      {/* Mockup */}
      <div className="mt-16 w-full max-w-2xl lg:max-w-3xl">
        <InboxMockup />
      </div>
    </section>
  );
}
