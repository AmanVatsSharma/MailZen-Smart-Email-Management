import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    beforeSend(event) {
      // Strip auth headers to avoid leaking credentials.
      if (event.request?.headers) {
        const sanitized = { ...event.request.headers };
        for (const header of ['authorization', 'cookie', 'set-cookie']) {
          if (sanitized[header]) sanitized[header] = '[Filtered]';
        }
        event.request.headers = sanitized;
      }
      return event;
    },
  });
}
