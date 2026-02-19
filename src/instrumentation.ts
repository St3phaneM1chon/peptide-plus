/**
 * INSTRUMENTATION - Next.js instrumentation hook
 *
 * Initializes Sentry for server-side error tracking.
 * This file is automatically loaded by Next.js 15 via the instrumentation hook.
 *
 * Requires:
 *   - SENTRY_DSN environment variable
 *   - @sentry/nextjs package (optional - degrades gracefully)
 */

export async function register() {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.npm_package_version || '1.0.0',

        // Performance monitoring sample rate (adjust for production costs)
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Only send errors in production, log in development
        enabled: process.env.NODE_ENV === 'production',

        // Filter out noisy errors
        ignoreErrors: [
          'NEXT_NOT_FOUND',
          'NEXT_REDIRECT',
          'AbortError',
          'cancelled',
        ],

        // Attach server name for multi-instance debugging
        serverName: process.env.HOSTNAME || 'peptide-plus',

        // Integrations
        integrations: [
          Sentry.prismaIntegration
            ? Sentry.prismaIntegration()
            : undefined,
        ].filter(Boolean) as ReturnType<typeof Sentry.prismaIntegration>[],

        // Before sending hook - strip PII if needed
        beforeSend(event) {
          // Remove cookie values from headers
          if (event.request?.headers) {
            delete event.request.headers['cookie'];
            delete event.request.headers['authorization'];
          }
          return event;
        },
      });
    } catch {
      // @sentry/nextjs not installed -- application runs without Sentry
      console.info('[instrumentation] Sentry SDK not available, skipping initialization');
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        enabled: process.env.NODE_ENV === 'production',
      });
    } catch {
      // Edge runtime - Sentry not available
    }
  }
}
