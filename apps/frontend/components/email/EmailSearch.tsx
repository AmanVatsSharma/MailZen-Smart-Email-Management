import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface EmailSearchProps {
  onSearch: (query: string) => void;
  onSemanticSearch?: (query: string) => void;
  className?: string;
  placeholder?: string;
  initialQuery?: string;
}

export function EmailSearch({
  onSearch,
  onSemanticSearch,
  className = '',
  placeholder = 'Search emails...',
  initialQuery = '',
}: EmailSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [smartMode, setSmartMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timerId);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      // Always reset to keyword results when cleared
      onSearch('');
      return;
    }
    if (smartMode && onSemanticSearch) {
      onSemanticSearch(debouncedQuery);
    } else {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, smartMode, onSearch, onSemanticSearch]);

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const toggleSmartMode = () => {
    setSmartMode((prev) => {
      const next = !prev;
      // Re-run search with the new mode immediately
      if (debouncedQuery) {
        if (next && onSemanticSearch) {
          onSemanticSearch(debouncedQuery);
        } else {
          onSearch(debouncedQuery);
        }
      }
      return next;
    });
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={cn(
          'flex items-center w-full rounded-md border transition-all duration-200',
          isFocused
            ? smartMode
              ? 'ring-2 ring-primary/30 border-primary'
              : 'ring-2 ring-primary/20 border-primary'
            : 'border-input',
        )}
      >
        <Search
          className={cn(
            'absolute left-3 h-4 w-4 transition-colors shrink-0',
            isFocused ? 'text-primary' : 'text-muted-foreground',
          )}
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={smartMode ? 'Smart search (AI semantic)...' : placeholder}
          className="pl-9 pr-20 py-2 h-10 border-none shadow-none focus-visible:ring-0"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {/* Right side controls */}
        <div className="absolute right-2 flex items-center gap-1">
          <AnimatePresence>
            {query && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleClear}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Smart search toggle */}
          <button
            type="button"
            title={smartMode ? 'Smart Search active — click to use keyword search' : 'Enable Smart Search (AI semantic)'}
            onClick={toggleSmartMode}
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
              smartMode
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground',
            )}
          >
            <Sparkles className="h-3 w-3" />
            {smartMode ? 'Smart' : 'AI'}
          </button>
        </div>
      </div>

      {/* Smart mode hint */}
      <AnimatePresence>
        {smartMode && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-1 pt-1 text-[10px] text-primary/70"
          >
            ✦ Smart Search uses AI to find semantically related emails
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
