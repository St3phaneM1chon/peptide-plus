export const dynamic = 'force-dynamic';

/**
 * WEBHOOK RETRY CRON JOB (A9-P0-002)
 *
 * POST /api/cron/retry-webhooks - Retry failed webhook events
 * GET  /api/cron/retry-webhooks - Health check / show pending retries
 *
 * Finds WebhookEvent records with status='FAILED' that have not exceeded
 * the max retry count (3), and re-dispatches them to the appropriate
 * webhook handler based on the provider field.
 *
 * Authentication: Requires CRON_SECRET in Authorization header.
 * Recommended schedule: every 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withJobLock } from '@/lib/cron-lock';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BATCH_SIZE = 10;

// Retry delays in minutes: 5min, 30min, 2h
const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET - Health check / show pending retries
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const failedCount = await prisma.webhookEvent.count({
      where: { status: 'FAILED' },
    });

    // Count retryable events (those where errorMessage doesn't contain max retry marker)
    const retryableEvents = await prisma.webhookEvent.findMany({
      where: {
        status: 'FAILED',
        NOT: { errorMessage: { contains: `[Retry ${MAX_RETRIES}]` } },
      },
      select: {
        id: true,
        provider: true,
        eventType: true,
        errorMessage: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      status: 'ok',
      failedTotal: failedCount,
      retryable: retryableEvents.length,
      events: retryableEvents,
    });
  } catch (error) {
    logger.error('[cron/retry-webhooks] Health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST - Execute retry
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('retry-webhooks', async () => {
    const results = { retried: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] as string[] };

    try {
      // Find retryable failed events (not yet at max retries)
      const failedEvents = await prisma.webhookEvent.findMany({
        where: {
          status: 'FAILED',
          NOT: { errorMessage: { contains: `[Retry ${MAX_RETRIES}]` } },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (failedEvents.length === 0) {
        return NextResponse.json({
          status: 'ok',
          message: 'No retryable webhook events',
          results,
        });
      }

      for (const event of failedEvents) {
        // Parse current retry count from errorMessage
        const retryMatch = event.errorMessage?.match(/\[Retry (\d+)\]/);
        const currentRetry = retryMatch ? parseInt(retryMatch[1], 10) : 0;

        if (currentRetry >= MAX_RETRIES) {
          results.skipped++;
          continue;
        }

        // Check if enough time has passed since last attempt (backoff)
        const minDelay = RETRY_DELAYS_MS[currentRetry] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        const lastAttemptTime = event.processedAt || event.createdAt;
        if (Date.now() - lastAttemptTime.getTime() < minDelay) {
          results.skipped++;
          continue;
        }

        results.retried++;
        const nextRetry = currentRetry + 1;

        try {
          // Re-dispatch based on provider
          const handlerUrl = getHandlerUrl(event.provider);
          if (!handlerUrl) {
            logger.warn('[cron/retry-webhooks] No handler URL for provider', {
              provider: event.provider,
              eventId: event.eventId,
            });
            results.skipped++;
            continue;
          }

          // Mark as processing
          await prisma.webhookEvent.update({
            where: { id: event.id },
            data: {
              status: 'PROCESSING',
              errorMessage: `[Retry ${nextRetry}] Retrying...`,
            },
          });

          // Re-dispatch the event internally
          // For Stripe/PayPal, we can't re-verify signatures on replay,
          // so we process the stored payload directly
          const payload = event.payload ? JSON.parse(event.payload) : null;
          if (!payload) {
            await prisma.webhookEvent.update({
              where: { id: event.id },
              data: {
                status: 'FAILED',
                errorMessage: `[Retry ${nextRetry}] No payload stored — cannot retry`,
                processedAt: new Date(),
              },
            });
            results.failed++;
            continue;
          }

          // Process the event by type
          const success = await processRetry(event.provider, event.eventType, payload, event.orderId);

          if (success) {
            await prisma.webhookEvent.update({
              where: { id: event.id },
              data: {
                status: 'COMPLETED',
                errorMessage: `[Retry ${nextRetry}] Succeeded`,
                processedAt: new Date(),
              },
            });
            results.succeeded++;
          } else {
            await prisma.webhookEvent.update({
              where: { id: event.id },
              data: {
                status: 'FAILED',
                errorMessage: `[Retry ${nextRetry}] Processing returned false`,
                processedAt: new Date(),
              },
            });
            results.failed++;
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          await prisma.webhookEvent.update({
            where: { id: event.id },
            data: {
              status: 'FAILED',
              errorMessage: `[Retry ${nextRetry}] ${errMsg}`.slice(0, 500),
              processedAt: new Date(),
            },
          });
          results.failed++;
          results.errors.push(`${event.eventId}: ${errMsg}`);
        }
      }

      logger.info('[cron/retry-webhooks] Retry batch complete', results);

      return NextResponse.json({
        status: 'ok',
        results,
      });
    } catch (error) {
      logger.error('[cron/retry-webhooks] Cron execution failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Retry execution failed', results },
        { status: 500 }
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHandlerUrl(provider: string): string | null {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  switch (provider.toLowerCase()) {
    case 'stripe':
      return `${baseUrl}/api/payments/webhook`;
    case 'paypal':
      return `${baseUrl}/api/webhooks/paypal`;
    default:
      return null;
  }
}

/**
 * Process a retried webhook event from stored payload.
 * This bypasses signature verification (which can't work on replayed events)
 * and directly processes the business logic.
 */
async function processRetry(
  provider: string,
  eventType: string,
  payload: Record<string, unknown>,
  orderId: string | null
): Promise<boolean> {
  try {
    switch (provider.toLowerCase()) {
      case 'stripe':
        return await processStripeRetry(eventType, payload, orderId);
      case 'paypal':
        return await processPaypalRetry(eventType, payload, orderId);
      default:
        logger.warn('[cron/retry-webhooks] Unsupported provider for retry', { provider });
        return false;
    }
  } catch (error) {
    logger.error('[cron/retry-webhooks] processRetry failed', {
      provider,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function processStripeRetry(
  eventType: string,
  _payload: Record<string, unknown>,
  orderId: string | null
): Promise<boolean> {
  // For retried Stripe events, update the order status based on event type
  if (!orderId) {
    logger.warn('[cron/retry-webhooks] No orderId for Stripe retry', { eventType });
    return false;
  }

  switch (eventType) {
    case 'charge.refunded': {
      // Update order status to REFUNDED if not already
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status === 'REFUNDED') return true; // Already processed

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED' },
      });
      logger.info('[cron/retry-webhooks] Stripe refund retry processed', { orderId });
      return true;
    }
    case 'payment_intent.payment_failed': {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status === 'CANCELLED') return true;

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });
      logger.info('[cron/retry-webhooks] Stripe payment failure retry processed', { orderId });
      return true;
    }
    default:
      logger.info('[cron/retry-webhooks] Stripe event type not retryable', { eventType });
      return true; // Mark as succeeded to stop retrying
  }
}

async function processPaypalRetry(
  eventType: string,
  _payload: Record<string, unknown>,
  orderId: string | null
): Promise<boolean> {
  if (!orderId) {
    logger.warn('[cron/retry-webhooks] No orderId for PayPal retry', { eventType });
    return false;
  }

  switch (eventType) {
    case 'PAYMENT.CAPTURE.REFUNDED': {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status === 'REFUNDED') return true;

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED' },
      });
      logger.info('[cron/retry-webhooks] PayPal refund retry processed', { orderId });
      return true;
    }
    case 'PAYMENT.CAPTURE.DENIED': {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.status === 'CANCELLED') return true;

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });
      logger.info('[cron/retry-webhooks] PayPal denial retry processed', { orderId });
      return true;
    }
    default:
      logger.info('[cron/retry-webhooks] PayPal event type not retryable', { eventType });
      return true;
  }
}
