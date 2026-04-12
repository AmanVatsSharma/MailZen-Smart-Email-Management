'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      title="Dashboard error"
      description="An unexpected error occurred in the dashboard. Please try refreshing."
    >
      <MainLayout>{children}</MainLayout>
    </ErrorBoundary>
  );
}
