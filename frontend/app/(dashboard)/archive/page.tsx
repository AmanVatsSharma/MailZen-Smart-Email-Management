'use client';

import React, { useState } from 'react';
import {EmailList} from '@/components/email/EmailList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EmailDetail } from '@/components/email/EmailDetail';
import { EmailComposer } from '@/components/email/EmailComposer';

const ArchivePage = () => {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmailId(emailId);
  };

  const handleBackToArchive = () => {
    setSelectedEmailId(null);
  };

  const handleComposeEmail = () => {
    setComposerOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Archive</h1>
        <Button onClick={handleComposeEmail} className="gap-1">
          <Plus className="h-4 w-4" />
          Compose
        </Button>
      </div>

      <div className="flex-1 border rounded-lg overflow-hidden bg-card">
        {selectedEmailId ? (
          <EmailDetail emailId={selectedEmailId} onBack={handleBackToArchive} />
        ) : (
          <EmailList onEmailSelect={handleSelectEmail} />
        )}
      </div>

      <EmailComposer isOpen={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
};

export default ArchivePage;
