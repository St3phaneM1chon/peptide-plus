/**
 * Platform Webhook Handlers
 * Validates incoming webhook payloads and triggers recording imports.
 */

import { createHmac } from 'crypto';
import { prisma } from '@/lib/db';
import { syncRecordings } from './recording-import';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zoom Webhook Handler
// ---------------------------------------------------------------------------

/**
 * Validate Zoom webhook signature.
 * Zoom sends: x-zm-request-timestamp, x-zm-signature
 * Signature = hex(HMAC-SHA256(webhookSecret, "v0:{timestamp}:{body}"))
 */
export function validateZoomSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const message = `v0:${timestamp}:${body}`;
  const hash = createHmac('sha256', secret).update(message).digest('hex');
  const expected = `v0=${hash}`;
  return expected === signature;
}

/**
 * Handle Zoom webhook event.
 * Supports: recording.completed, endpoint.url_validation (challenge-response)
 */
export async function handleZoomWebhook(
  body: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const event = body.event as string;

  // Zoom URL validation challenge (required during webhook setup)
  if (event === 'endpoint.url_validation') {
    const plainToken = (body.payload as Record<string, unknown>)?.plainToken as string;
    const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '';
    const encryptedToken = createHmac('sha256', secret).update(plainToken).digest('hex');

    return {
      status: 200,
      body: { plainToken, encryptedToken },
    };
  }

  // Recording completed
  if (event === 'recording.completed') {
    logger.info('[Webhook] Zoom recording.completed received');

    // Check if Zoom is connected and auto-import is enabled
    const connection = await prisma.platformConnection.findUnique({
      where: { platform: 'zoom' },
    });

    if (connection?.isEnabled && connection.autoImport) {
      // Trigger async sync (don't block webhook response)
      syncRecordings('zoom').catch((err) => {
        logger.error('[Webhook] Zoom auto-sync failed:', err);
      });
    }

    return { status: 200, body: { received: true } };
  }

  // Recording transcript completed
  if (event === 'recording.transcript_completed') {
    logger.info('[Webhook] Zoom recording.transcript_completed received');
    return { status: 200, body: { received: true } };
  }

  return { status: 200, body: { received: true, event } };
}

// ---------------------------------------------------------------------------
// Teams (Graph API) Webhook Handler
// ---------------------------------------------------------------------------

/**
 * Handle Microsoft Teams Graph API change notification.
 * Teams requires a validation handshake when subscribing.
 */
export async function handleTeamsWebhook(
  body: Record<string, unknown>,
  validationToken?: string | null
): Promise<{ status: number; body: unknown }> {
  // Subscription validation - Teams sends validationToken on subscribe
  if (validationToken) {
    return {
      status: 200,
      body: validationToken, // Must return the token as plain text
    };
  }

  const notifications = (body.value as Array<Record<string, unknown>>) || [];

  for (const notification of notifications) {
    const changeType = notification.changeType as string;
    const resource = notification.resource as string;

    logger.info(`[Webhook] Teams notification: ${changeType} on ${resource}`);

    if (resource?.includes('callRecords') || resource?.includes('recordings')) {
      const connection = await prisma.platformConnection.findUnique({
        where: { platform: 'teams' },
      });

      if (connection?.isEnabled && connection.autoImport) {
        syncRecordings('teams').catch((err) => {
          logger.error('[Webhook] Teams auto-sync failed:', err);
        });
      }
    }
  }

  return { status: 202, body: { received: true } };
}

// ---------------------------------------------------------------------------
// Webex Webhook Handler
// ---------------------------------------------------------------------------

/**
 * Validate Webex webhook signature.
 * Webex sends X-Spark-Signature as HMAC-SHA1 of the body.
 */
export function validateWebexSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hash = createHmac('sha1', secret).update(body).digest('hex');
  return hash === signature;
}

/**
 * Handle Webex webhook event.
 */
export async function handleWebexWebhook(
  body: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const event = body.event as string;
  const resource = body.resource as string;

  logger.info(`[Webhook] Webex event: ${event} resource: ${resource}`);

  if (resource === 'meetings' && (event === 'ended' || event === 'meetingEnded')) {
    const connection = await prisma.platformConnection.findUnique({
      where: { platform: 'webex' },
    });

    if (connection?.isEnabled && connection.autoImport) {
      // Wait a bit for recording to be available, then sync
      setTimeout(() => {
        syncRecordings('webex').catch((err) => {
          logger.error('[Webhook] Webex auto-sync failed:', err);
        });
      }, 30_000); // 30 second delay for recording processing
    }
  }

  return { status: 200, body: { received: true } };
}
