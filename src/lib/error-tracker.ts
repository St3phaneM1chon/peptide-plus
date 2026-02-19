/**
 * ERROR TRACKER - Error tracking with Sentry integration
 *
 * Captures exceptions and messages with structured context.
 * Forwards to Sentry when SENTRY_DSN is configured, otherwise logs via Winston.
 *
 * Usage:
 *   import { errorTracker } from '@/lib/error-tracker';
 *
 *   try { ... } catch (err) {
 *     errorTracker.captureException(err, { userId, action: 'checkout' });
 *   }
 *
 *   errorTracker.captureMessage('Rate limit exceeded', 'warn', { ip });
 */

import { logger } from '@/lib/logger';

type ErrorContext = Record<string, unknown>;
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Lazy-loaded Sentry module reference
let Sentry: typeof import('@sentry/nextjs') | null = null;
let sentryInitAttempted = false;

/**
 * Lazily load and return the Sentry module.
 * Returns null if @sentry/nextjs is not installed or SENTRY_DSN is not set.
 */
function getSentry(): typeof import('@sentry/nextjs') | null {
  if (sentryInitAttempted) return Sentry;
  sentryInitAttempted = true;

  if (!process.env.SENTRY_DSN) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require('@sentry/nextjs');
    return Sentry;
  } catch {
    // @sentry/nextjs not installed -- degrade gracefully
    logger.debug('Sentry SDK not installed, error tracking via Winston only');
    return null;
  }
}

class ErrorTracker {
  /**
   * Capture and log an exception with optional context.
   * Forwards to Sentry when available, always logs via Winston.
   */
  captureException(error: unknown, context?: ErrorContext): void {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error(err.message, {
      errorName: err.name,
      stack: err.stack,
      ...context,
    });

    const sentry = getSentry();
    if (sentry) {
      sentry.captureException(err, {
        extra: context,
      });
    }
  }

  /**
   * Log a structured message at the given level with optional context.
   * Useful for non-exception events that still warrant tracking
   * (e.g. business-logic warnings, anomalous but handled conditions).
   */
  captureMessage(
    message: string,
    level: LogLevel = 'info',
    context?: ErrorContext,
  ): void {
    logger.log(level, message, {
      ...context,
    });

    const sentry = getSentry();
    if (sentry) {
      sentry.captureMessage(message, {
        level: level === 'warn' ? 'warning' : level,
        extra: context,
      });
    }
  }

  /**
   * Set user context for Sentry (call after authentication).
   */
  setUser(user: { id: string; email?: string; role?: string } | null): void {
    const sentry = getSentry();
    if (sentry) {
      sentry.setUser(user ? { id: user.id, email: user.email, role: user.role } : null);
    }
  }

  /**
   * Add breadcrumb for debugging trail.
   */
  addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    const sentry = getSentry();
    if (sentry) {
      sentry.addBreadcrumb({ category, message, data, level: 'info' });
    }
  }
}

/**
 * Singleton error tracker instance.
 */
export const errorTracker = new ErrorTracker();

export default errorTracker;
