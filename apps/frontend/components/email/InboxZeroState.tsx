import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { CheckCircle2, Send, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InboxZeroStateProps {
  onCompose?: () => void;
}

export function InboxZeroState({ onCompose }: InboxZeroStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      {/* Celebration icon */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
        className="relative mb-6"
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-primary/60"
            style={{
              top: `${20 + Math.sin((i / 6) * Math.PI * 2) * 40}px`,
              left: `${40 + Math.cos((i / 6) * Math.PI * 2) * 40}px`,
            }}
            animate={{
              y: [0, -8, 0],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 2 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>

      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-semibold tracking-tight"
      >
        You&apos;re all caught up
        <span className="ml-2 text-primary">✦</span>
      </motion.h2>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-2 text-sm text-muted-foreground max-w-xs"
      >
        MailZen AI is monitoring your inbox for new messages.
        Enjoy the moment of clarity.
      </motion.p>

      {/* Action cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 flex flex-col sm:flex-row gap-3"
      >
        <Link href="/sent">
          <Button variant="outline" className="gap-2 group">
            <Send className="h-4 w-4 group-hover:text-primary transition-colors" />
            Review Sent
          </Button>
        </Link>
        {onCompose && (
          <Button variant="outline" className="gap-2 group" onClick={onCompose}>
            <FileText className="h-4 w-4 group-hover:text-primary transition-colors" />
            Browse Templates
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}
