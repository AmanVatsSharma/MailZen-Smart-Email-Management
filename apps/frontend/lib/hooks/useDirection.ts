'use client';

import { useEffect, useState } from 'react';

export type Direction = 'ltr' | 'rtl';

/**
 * Returns the current text direction ('ltr' | 'rtl') by reading the
 * computed `direction` style on the document root. Defaults to 'ltr'
 * during SSR. Updates live if the direction attribute changes.
 *
 * Why not `useSyncExternalStore` or context?
 * - The direction is a property of <html>/<body>, not React state. Listening
 *   via MutationObserver catches `dir` attribute flips on <html>.
 */
export function useDirection(): Direction {
  const [dir, setDir] = useState<Direction>('ltr');

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const compute = () => {
      const d = (document.documentElement.dir ||
        getComputedStyle(document.documentElement).direction ||
        'ltr') as Direction;
      setDir(d === 'rtl' ? 'rtl' : 'ltr');
    };

    compute();

    // Listen for dir attribute changes (e.g. user switches language).
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir'],
    });

    return () => observer.disconnect();
  }, []);

  return dir;
}
