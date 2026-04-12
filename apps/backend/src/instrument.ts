import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Sentry initialisation — must be imported at the very top of main.ts
 * before any other application code.
 *
 * Set SENTRY_DSN to enable. If unset, Sentry operates in no-op mode
 * so the app runs normally without error tracking.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    beforeSend(event) {
      // Strip sensitive request headers before sending to Sentry.
      if (event.request?.headers) {
        const sanitized = { ...event.request.headers };
        for (const header of ['authorization', 'cookie', 'set-cookie', 'x-api-key']) {
          if (sanitized[header]) sanitized[header] = '[Filtered]';
        }
        event.request.headers = sanitized;
      }
      return event;
    },
  });
}
