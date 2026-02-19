/**
 * OUTGOING WEBHOOK DISPATCHER
 * Dispatches webhook events to registered endpoints with HMAC-SHA256 signing,
 * delivery tracking via Prisma, and retry with exponential backoff.
 *
 * Usage:
 *   import { dispatchWebhook } from '@/lib/webhooks/outgoing';
 *   await dispatchWebhook('order.paid', { orderId: '123', total: 99.95 });
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { WebhookEventType } from '@/lib/webhooks/events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  name: string | null;
}

interface DeliveryResult {
  endpointId: string;
  deliveryId: string;
  success: boolean;
  status: number;
  duration: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum retry attempts per delivery */
const MAX_ATTEMPTS = 3;

/** Backoff delays in milliseconds: 1s, 30s, 300s */
const BACKOFF_DELAYS_MS = [1_000, 30_000, 300_000];

/** Delivery request timeout in milliseconds */
const DELIVERY_TIMEOUT_MS = 10_000;

/** Signature header name */
const SIGNATURE_HEADER = 'x-webhook-signature';

/** Timestamp header for replay-attack protection */
const TIMESTAMP_HEADER = 'x-webhook-timestamp';

/** Event header */
const EVENT_HEADER = 'x-webhook-event';

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Dispatch a webhook event to all active endpoints subscribed to it.
 *
 * 1. Finds all active endpoints subscribed to the event
 * 2. For each endpoint, signs the payload and POSTs it
 * 3. Logs the delivery result (success or failure)
 * 4. On failure, queues for retry with exponential backoff
 */
export async function dispatchWebhook(
  event: WebhookEventType | string,
  payload: Record<string, unknown>
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  let endpoints: WebhookEndpoint[];
  try {
    endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        active: true,
        events: { has: event },
      },
    });
  } catch (err) {
    logger.error('[webhooks/outgoing] Failed to query endpoints', {
      event,
      error: err instanceof Error ? err.message : String(err),
    });
    return results;
  }

  if (endpoints.length === 0) {
    logger.debug('[webhooks/outgoing] No endpoints subscribed', { event });
    return results;
  }

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  // Dispatch in parallel to all endpoints
  const deliveryPromises = endpoints.map(async (endpoint) => {
    const result = await deliverToEndpoint(endpoint, event, body);
    results.push(result);

    // If first attempt failed, schedule retry
    if (!result.success) {
      scheduleRetry(result.deliveryId, endpoint, event, body, 1).catch((retryErr) => {
        logger.error('[webhooks/outgoing] Failed to schedule retry', {
          deliveryId: result.deliveryId,
          error: retryErr instanceof Error ? retryErr.message : String(retryErr),
        });
      });
    }
  });

  await Promise.allSettled(deliveryPromises);
  return results;
}

// ---------------------------------------------------------------------------
// Cryptographic helpers
// ---------------------------------------------------------------------------

/**
 * Sign a payload string with HMAC-SHA256 using the endpoint secret.
 */
export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify an HMAC-SHA256 signature against a payload and secret.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Replay a specific delivery
// ---------------------------------------------------------------------------

/**
 * Replay a webhook delivery by its ID.
 * Fetches the original delivery, re-signs, and re-sends.
 */
export async function replayDelivery(deliveryId: string): Promise<DeliveryResult> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });

  if (!delivery) {
    throw new Error(`Delivery ${deliveryId} not found`);
  }

  if (!delivery.endpoint.active) {
    throw new Error(`Endpoint ${delivery.endpoint.id} is inactive`);
  }

  const body = JSON.stringify(delivery.payload);
  return deliverToEndpoint(delivery.endpoint, delivery.event, body);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Deliver a signed payload to a single endpoint and record the result.
 */
async function deliverToEndpoint(
  endpoint: WebhookEndpoint,
  event: string,
  body: string
): Promise<DeliveryResult> {
  const timestamp = Date.now().toString();
  const signedContent = `${timestamp}.${body}`;
  const signature = signPayload(signedContent, endpoint.secret);

  // Create the delivery record before sending (status 0 = pending)
  let delivery;
  try {
    delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        payload: JSON.parse(body),
        status: 0,
        attempts: 1,
      },
    });
  } catch (dbErr) {
    logger.error('[webhooks/outgoing] Failed to create delivery record', {
      endpointId: endpoint.id,
      event,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
    return {
      endpointId: endpoint.id,
      deliveryId: '',
      success: false,
      status: 0,
      duration: 0,
    };
  }

  const start = Date.now();
  let httpStatus = 0;
  let responseBody = '';
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SIGNATURE_HEADER]: signature,
        [TIMESTAMP_HEADER]: timestamp,
        [EVENT_HEADER]: event,
        'User-Agent': 'PeptidePlus-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    httpStatus = response.status;
    responseBody = await response.text().catch(() => '');
    success = httpStatus >= 200 && httpStatus < 300;

    logger.info('[webhooks/outgoing] Delivery completed', {
      deliveryId: delivery.id,
      endpointId: endpoint.id,
      event,
      status: httpStatus,
      success,
      durationMs: Date.now() - start,
    });
  } catch (fetchErr) {
    responseBody = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    logger.error('[webhooks/outgoing] Delivery failed', {
      deliveryId: delivery.id,
      endpointId: endpoint.id,
      event,
      error: responseBody,
    });
  }

  const duration = Date.now() - start;

  // Update delivery record
  try {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: httpStatus,
        response: responseBody.slice(0, 2000), // Truncate for storage
        duration,
        lastAttempt: new Date(),
      },
    });
  } catch (dbErr) {
    logger.error('[webhooks/outgoing] Failed to update delivery record', {
      deliveryId: delivery.id,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }

  return {
    endpointId: endpoint.id,
    deliveryId: delivery.id,
    success,
    status: httpStatus,
    duration,
  };
}

/**
 * Schedule a retry for a failed delivery with exponential backoff.
 * Delays: attempt 1 => 1s, attempt 2 => 30s, attempt 3 => 300s
 */
async function scheduleRetry(
  deliveryId: string,
  endpoint: WebhookEndpoint,
  event: string,
  body: string,
  attempt: number
): Promise<void> {
  if (attempt >= MAX_ATTEMPTS) {
    logger.warn('[webhooks/outgoing] Max retry attempts reached', {
      deliveryId,
      endpointId: endpoint.id,
      event,
      attempts: attempt,
    });
    return;
  }

  const delay = BACKOFF_DELAYS_MS[attempt] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];

  logger.info('[webhooks/outgoing] Scheduling retry', {
    deliveryId,
    attempt: attempt + 1,
    delayMs: delay,
  });

  // Use setTimeout for retry (in production, this could be replaced by a job queue)
  setTimeout(async () => {
    const timestamp = Date.now().toString();
    const signedContent = `${timestamp}.${body}`;
    const signature = signPayload(signedContent, endpoint.secret);

    const start = Date.now();
    let httpStatus = 0;
    let responseBody = '';
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: signature,
          [TIMESTAMP_HEADER]: timestamp,
          [EVENT_HEADER]: event,
          'User-Agent': 'PeptidePlus-Webhooks/1.0',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      httpStatus = response.status;
      responseBody = await response.text().catch(() => '');
      success = httpStatus >= 200 && httpStatus < 300;
    } catch (fetchErr) {
      responseBody = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    }

    const duration = Date.now() - start;

    // Update delivery record with retry result
    try {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: httpStatus,
          attempts: attempt + 1,
          response: responseBody.slice(0, 2000),
          duration,
          lastAttempt: new Date(),
        },
      });
    } catch {
      // Silently fail -- the delivery still happened
    }

    logger.info('[webhooks/outgoing] Retry completed', {
      deliveryId,
      attempt: attempt + 1,
      status: httpStatus,
      success,
      durationMs: duration,
    });

    // If still failing, schedule next retry
    if (!success) {
      await scheduleRetry(deliveryId, endpoint, event, body, attempt + 1);
    }
  }, delay);
}
