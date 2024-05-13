import React from 'react';
import PremiumShowcase from '@/components/premium/Showcase';

export default function DesignSystemPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-6">MailZen Design System</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Explore our premium UI components and design patterns used throughout the MailZen application.
      </p>
      
      <PremiumShowcase />
    </div>
  );
} 