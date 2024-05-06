'use client';

import React, { useState } from 'react';
import EmailList from '@/components/email/EmailList';
import EmailDetail from '@/components/email/EmailDetail';
import EmailComposer from '@/components/email/EmailComposer';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, RefreshCw } from 'lucide-react';

const TrashPage = () => {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmailId(emailId);
  };

  const handleBackToTrash = () => {
    setSelectedEmailId(null);
  };

  const handleComposeEmail = () => {
    setComposerOpen(true);
  };

  const handleEmptyTrash = () => {
    // In a real app, this would call an API to empty the trash
    console.log('Empty trash');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trash</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEmptyTrash} className="gap-1">
            <Trash2 className="h-4 w-4" />
            Empty Trash
          </Button>
          <Button onClick={handleComposeEmail} className="gap-1">
            <Plus className="h-4 w-4" />
            Compose
          </Button>
        </div>
      </div>

      <div className="flex-1 border rounded-lg overflow-hidden bg-card">
        {selectedEmailId ? (
          <EmailDetail emailId={selectedEmailId} onBack={handleBackToTrash} />
        ) : (
          <EmailList onEmailSelect={handleSelectEmail} />
        )}
      </div>

      <EmailComposer isOpen={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
};

export default TrashPage;
