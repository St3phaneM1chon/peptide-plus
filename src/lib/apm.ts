/**
 * APPLICATION PERFORMANCE MONITORING (APM)
 *
 * Provides performance spans and metric recording.
 * Integrates with Sentry Performance when available, otherwise uses
 * structured Winston logging as a lightweight alternative.
 *
 * Usage:
 *   import { startSpan, recordMetric, withPerformanceTracking } from '@/lib/apm';
 *
 *   const span = startSpan('prisma.query', { model: 'Order', operation: 'findMany' });
 *   const result = await prisma.order.findMany(...);
 *   span.end();
 *
 *   recordMetric('api.response_time', 245, 'ms');
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Span {
  /** End the span and record its duration */
  end: () => void;
  /** Mark the span as failed */
  setError: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Sentry lazy loader
// ---------------------------------------------------------------------------

let Sentry: typeof import('@sentry/nextjs') | null = null;
let sentryChecked = false;

function getSentry(): typeof import('@sentry/nextjs') | null {
  if (sentryChecked) return Sentry;
  sentryChecked = true;

  if (!process.env.SENTRY_DSN) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require('@sentry/nextjs');
    return Sentry;
  } catch (error) {
    console.error('[APM] Failed to load @sentry/nextjs:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Span tracking
// ---------------------------------------------------------------------------

/**
 * Start a performance span for timing a block of code.
 *
 * @param name - Descriptive span name (e.g. 'prisma.query.Order.findMany')
 * @param attributes - Key-value pairs for additional context
 * @returns Span object with end() and setError() methods
 */
export function startSpan(
  name: string,
  attributes?: Record<string, string>,
): Span {
  const startTime = performance.now();
  let hasError = false;
  let errorMessage: string | undefined;

  const sentry = getSentry();

  // If Sentry is available, use its span API
  if (sentry && typeof sentry.startSpan === 'function') {
    // Sentry v8+ startSpan is callback-based, so we cannot use it directly.
    // Instead we create a manual breadcrumb + metric approach.
    sentry.addBreadcrumb({
      category: 'performance',
      message: `Span started: ${name}`,
      data: attributes,
      level: 'info',
    });
  }

  return {
    end() {
      const duration = Math.round((performance.now() - startTime) * 100) / 100;

      // Log slow operations (>1s) as warnings
      const level = duration > 1000 ? 'warn' : 'debug';
      logger.log(level, `[APM] ${name}`, {
        spanName: name,
        durationMs: duration,
        status: hasError ? 'error' : 'ok',
        ...(errorMessage ? { error: errorMessage } : {}),
        ...attributes,
      });

      // Record as metric
      recordMetric(`span.${name}`, duration, 'ms');
    },

    setError(error: Error) {
      hasError = true;
      errorMessage = error.message;
    },
  };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * In-memory metrics buffer for the current process.
 * Periodically flushed or queried by the metrics endpoint.
 */
interface MetricEntry {
  name: string;
  value: number;
  unit?: string;
  timestamp: number;
}

const metricsBuffer: MetricEntry[] = [];
const MAX_BUFFER_SIZE = 10000;

/**
 * Record a numeric metric value.
 *
 * @param name - Metric name (e.g. 'api.response_time', 'db.query_count')
 * @param value - Numeric value
 * @param unit - Optional unit (e.g. 'ms', 'bytes', 'count')
 */
export function recordMetric(
  name: string,
  value: number,
  unit?: string,
): void {
  // Add to buffer (circular)
  if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
    metricsBuffer.shift();
  }

  metricsBuffer.push({
    name,
    value,
    unit,
    timestamp: Date.now(),
  });
}

/**
 * Get recent metrics from the buffer, optionally filtered by name prefix.
 */
export function getRecentMetrics(
  namePrefix?: string,
  sinceMs?: number,
): MetricEntry[] {
  const since = sinceMs ?? Date.now() - 60 * 60 * 1000; // last hour default
  return metricsBuffer.filter(
    (m) =>
      m.timestamp >= since &&
      (!namePrefix || m.name.startsWith(namePrefix)),
  );
}

/**
 * Clear the metrics buffer (useful for testing).
 */
export function clearMetrics(): void {
  metricsBuffer.length = 0;
}

// ---------------------------------------------------------------------------
// Higher-order function for wrapping async operations
// ---------------------------------------------------------------------------

/**
 * Wrap an async function with automatic performance tracking.
 *
 * Usage:
 *   const result = await withPerformanceTracking('stripe.createPayment', { orderId }, async () => {
 *     return stripe.paymentIntents.create(...);
 *   });
 */
export async function withPerformanceTracking<T>(
  name: string,
  attributes: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  const span = startSpan(name, attributes);
  try {
    const result = await fn();
    span.end();
    return result;
  } catch (error) {
    span.setError(error instanceof Error ? error : new Error(String(error)));
    span.end();
    throw error;
  }
}
