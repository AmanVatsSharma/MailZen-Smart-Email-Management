'use client';

import * as React from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * MotionProvider
 * -----------------------------------------------------------------------------
 * Reflects the OS-level `prefers-reduced-motion: reduce` setting as a
 * `data-reduced-motion="true"` attribute on the body. CSS and motion
 * libraries can then opt into globally quieting animations when present.
 *
 * Why a data attribute (not a context):
 *  - It's globally visible to CSS selectors without a JS subscription.
 *  - It works with framer-motion (which can read it) and vanilla CSS.
 *  - The body is the right scope — it's the root of the app's DOM.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia(QUERY);
    const apply = () => {
      document.body.dataset.reducedMotion = mq.matches ? 'true' : 'false';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return <>{children}</>;
}
