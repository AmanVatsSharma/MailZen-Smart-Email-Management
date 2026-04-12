import React from 'react';
import { notFound } from 'next/navigation';
import PremiumShowcase from '@/components/premium/Showcase';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <DashboardPageShell
      title="MailZen Design System"
      description="Explore premium UI components and interaction patterns used throughout MailZen."
      titleClassName="text-3xl font-bold"
    >
      <PremiumShowcase />
    </DashboardPageShell>
  );
} 