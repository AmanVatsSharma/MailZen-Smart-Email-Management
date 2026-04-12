import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
};

const sentryOptions = {
  // Only upload source maps when SENTRY_AUTH_TOKEN is set.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Disable source map upload in local development.
  disableSourceMapUpload: process.env.NODE_ENV === 'development',
  // Automatically tree-shake Sentry logger statements.
  disableLogger: true,
  // Tunnel Sentry requests through Next.js to avoid ad-blocker interference.
  tunnelRoute: '/monitoring',
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

export default withSentryConfig(nextConfig, sentryOptions);
