/**
 * ERROR TRACKER - Lightweight error tracking utility
 *
 * Captures exceptions and messages with structured context.
 * Currently logs via Winston; can be extended to send to Sentry or
 * another error monitoring service in production.
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

class ErrorTracker {
  /**
   * Capture and log an exception with optional context.
   * In a future iteration this could forward to Sentry via
   * Sentry.captureException().
   */
  captureException(error: unknown, context?: ErrorContext): void {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error(err.message, {
      errorName: err.name,
      stack: err.stack,
      ...context,
    });

    // Future: Sentry integration
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureException(err, { extra: context });
    // }
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

    // Future: Sentry integration
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureMessage(message, level);
    // }
  }
}

/**
 * Singleton error tracker instance.
 */
export const errorTracker = new ErrorTracker();

export default errorTracker;
