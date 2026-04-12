'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { SenderIntelligencePanel } from '@/components/email/SenderIntelligencePanel';

export default function SenderIntelligencePage() {
  return (
    <DashboardPageShell
      title="Sender Intelligence"
      description="AI-scored relationships with your top correspondents — star senders to mark as VIP for priority routing"
      actions={
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'hsl(262 83% 58%)' }} />
          <span>Scores update as you receive email</span>
        </div>
      }
    >
      <div className="h-[calc(100vh-200px)]">
        <SenderIntelligencePanel />
      </div>
    </DashboardPageShell>
  );
}
