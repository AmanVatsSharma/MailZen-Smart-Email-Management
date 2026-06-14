'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CodeSnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      <pre className="p-4 text-xs font-mono overflow-x-auto max-h-48 bg-surface-2 text-foreground">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        aria-label="Copy code"
        className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded bg-surface-1 border border-border-subtle hover:bg-surface-3"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
