export const dynamic = 'force-dynamic';

/**
 * WEBHOOK - Shipping Tracking Status Updates
 *
 * I-SHIPPING: Accepts tracking status updates from carriers.
 * POST /api/webhooks/shipping
 *
 * Auth: SHIPPING_WEBHOOK_SECRET via timing-safe comparison.
 * Updates Order.trackingNumber, Order.carrier, Order.status, and timestamps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual, createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { validateTransition } from '@/lib/order-status-machine';
import { logger } from '@/lib/logger';

const trackingUpdateSchema = z.object({
  orderNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  status: z.string().min(1, 'status is required'),
  carrier: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  timestamp: z.string().optional(),
  location: z.string().optional(),
  details: z.string().optional(),
});

const shippingPayloadSchema = z.union([
  z.array(trackingUpdateSchema),
  trackingUpdateSchema,
]);

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, single-instance safe)
// ---------------------------------------------------------------------------

const rateLimitState = { windowStart: 0, count: 0 };
const RATE_LIMIT_MAX = 200; // carriers may send batches
const RATE_LIMIT_WINDOW_MS = 1000;

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - rateLimitState.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitState.windowStart = now;
    rateLimitState.count = 1;
    return true;
  }
  rateLimitState.count++;
  return rateLimitState.count <= RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Timing-safe comparison of webhook secret.
 * Prevents timing attacks on the secret value.
 */
function verifyWebhookSecret(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, 'utf-8');
    const b = Buffer.from(expected, 'utf-8');
    if (a.length !== b.length) {
      // Constant-time comparison requires equal lengths.
      // Hash both to normalize length before comparing.
      const ha = createHash('sha256').update(a).digest();
      const hb = createHash('sha256').update(b).digest();
      return timingSafeEqual(ha, hb);
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrackingUpdate {
  /** Order number or tracking number to identify the order */
  orderNumber?: string;
  trackingNumber?: string;
  /** New status: SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED */
  status: string;
  /** Carrier name (e.g. "Canada Post", "USPS", "DHL") */
  carrier?: string;
  /** Optional tracking URL */
  trackingUrl?: string;
  /** Optional ISO timestamp of the status change */
  timestamp?: string;
  /** Optional location description */
  location?: string;
  /** Optional details/notes about this status update */
  details?: string;
}

/** Allowed status values for tracking updates */
const VALID_TRACKING_STATUSES = new Set([
  'PROCESSING',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
  'EXCEPTION',
]);

/**
 * Status rank for idempotency: only allow forward-progressing status changes.
 * Prevents duplicate/retried webhooks from downgrading order status.
 */
const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PROCESSING: 2,
  SHIPPED: 3,
  IN_TRANSIT: 4,
  OUT_FOR_DELIVERY: 5,
  DELIVERED: 6,
  FAILED: 5,     // same tier as OUT_FOR_DELIVERY (can happen after)
  RETURNED: 7,
  EXCEPTION: 5,  // same tier as OUT_FOR_DELIVERY
};

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    if (!checkRateLimit()) {
      logger.warn('[shipping-webhook] Rate limit exceeded');
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Fail-closed: reject if no secret is configured
    const webhookSecret = process.env.SHIPPING_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn(
        '[shipping-webhook] SHIPPING_WEBHOOK_SECRET not configured. ' +
        'Set this env var to accept shipping tracking webhooks.',
      );
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 503 },
      );
    }

    // Authenticate: check Authorization header
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader || '';

    if (!providedSecret || !verifyWebhookSecret(providedSecret, webhookSecret)) {
      logger.warn('[shipping-webhook] Invalid or missing authorization');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = shippingPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    // Support single update or batch of updates
    const updates: TrackingUpdate[] = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 });
    }

    if (updates.length > 100) {
      return NextResponse.json({ error: 'Batch too large (max 100)' }, { status: 400 });
    }

    const results: Array<{ orderNumber?: string; trackingNumber?: string; success: boolean; error?: string }> = [];

    for (const update of updates) {
      try {
        const result = await processTrackingUpdate(update);
        results.push(result);
      } catch (error) {
        logger.error('[shipping-webhook] Error processing update', {
          orderNumber: update.orderNumber,
          trackingNumber: update.trackingNumber,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          orderNumber: update.orderNumber,
          trackingNumber: update.trackingNumber,
          success: false,
          error: 'Processing error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      received: true,
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      results,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[shipping-webhook] Unhandled error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

async function processTrackingUpdate(
  update: TrackingUpdate
): Promise<{ orderNumber?: string; trackingNumber?: string; success: boolean; error?: string }> {
  // Validate status
  if (!update.status || !VALID_TRACKING_STATUSES.has(update.status.toUpperCase())) {
    return {
      orderNumber: update.orderNumber,
      trackingNumber: update.trackingNumber,
      success: false,
      error: `Invalid status: ${update.status}. Valid: ${[...VALID_TRACKING_STATUSES].join(', ')}`,
    };
  }

  // Must have either orderNumber or trackingNumber to identify the order
  if (!update.orderNumber && !update.trackingNumber) {
    return { success: false, error: 'Must provide orderNumber or trackingNumber' };
  }

  // Find the order
  const order = await prisma.order.findFirst({
    where: update.orderNumber
      ? { orderNumber: update.orderNumber }
      : { trackingNumber: update.trackingNumber },
    select: { id: true, orderNumber: true, status: true, trackingNumber: true },
  });

  if (!order) {
    return {
      orderNumber: update.orderNumber,
      trackingNumber: update.trackingNumber,
      success: false,
      error: 'Order not found',
    };
  }

  // Idempotency: only allow forward-progressing status changes
  const status = update.status.toUpperCase();
  const currentRank = STATUS_RANK[order.status || 'PENDING'] ?? 0;
  const newRank = STATUS_RANK[status] ?? 0;

  if (newRank <= currentRank && status !== 'EXCEPTION' && status !== 'FAILED') {
    logger.info('[shipping-webhook] Skipped duplicate/stale update', {
      orderId: order.id,
      currentStatus: order.status,
      attemptedStatus: status,
    });
    return {
      orderNumber: order.orderNumber,
      trackingNumber: update.trackingNumber || order.trackingNumber || undefined,
      success: true, // Return success to prevent carrier retry
    };
  }

  // Validate transition using centralized state machine.
  // Webhooks log a warning but do NOT reject invalid transitions because
  // carrier data may arrive out of order or contain retries.
  const transition = validateTransition(order.status, status);
  if (!transition.valid) {
    logger.warn('[shipping-webhook] Out-of-order transition (proceeding anyway)', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      currentStatus: order.status,
      incomingStatus: status,
      reason: transition.error,
    });
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    status,
  };

  if (update.trackingNumber) {
    updateData.trackingNumber = update.trackingNumber;
  }
  if (update.trackingUrl) {
    updateData.trackingUrl = update.trackingUrl;
  }
  if (update.carrier) {
    updateData.carrier = update.carrier;
  }

  // Set timestamps based on status
  if (status === 'SHIPPED' || status === 'IN_TRANSIT') {
    if (!order.status || order.status === 'PENDING' || order.status === 'PROCESSING') {
      updateData.shippedAt = update.timestamp ? new Date(update.timestamp) : new Date();
    }
  }
  if (status === 'DELIVERED') {
    updateData.deliveredAt = update.timestamp ? new Date(update.timestamp) : new Date();
  }

  // Update the order
  await prisma.order.update({
    where: { id: order.id },
    data: updateData,
  });

  logger.info('[shipping-webhook] Order tracking updated', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    previousStatus: order.status,
    newStatus: status,
    trackingNumber: update.trackingNumber || order.trackingNumber,
    carrier: update.carrier,
  });

  return {
    orderNumber: order.orderNumber,
    trackingNumber: update.trackingNumber || order.trackingNumber || undefined,
    success: true,
  };
}
