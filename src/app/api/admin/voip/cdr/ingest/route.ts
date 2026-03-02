export const dynamic = 'force-dynamic';

/**
 * CDR Ingest Webhook
 * POST - Receives CDR data from FreeSWITCH mod_json_cdr
 *
 * This endpoint is called by FreeSWITCH after each call ends.
 * It does NOT require admin auth (webhook from PBX server).
 * Security: Validates shared secret in Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestCdr } from '@/lib/voip/cdr-sync';
import { processPendingRecordings } from '@/lib/voip/recording-upload';
import { logger } from '@/lib/logger';

/**
 * Validate webhook authentication.
 * mod_json_cdr sends credentials via Basic auth or custom header.
 */
function validateWebhookAuth(request: NextRequest): boolean {
  const secret = process.env.VOIP_CDR_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, accept all (dev mode)
    logger.warn('[CDR Webhook] No VOIP_CDR_WEBHOOK_SECRET configured');
    return true;
  }

  const authHeader = request.headers.get('authorization') || '';

  // Check Bearer token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7) === secret;
  }

  // Check custom header
  const customHeader = request.headers.get('x-cdr-secret') || '';
  if (customHeader === secret) return true;

  return false;
}

export async function POST(request: NextRequest) {
  if (!validateWebhookAuth(request)) {
    logger.warn('[CDR Webhook] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cdr = await request.json();
    const callLogId = await ingestCdr(cdr);

    if (!callLogId) {
      return NextResponse.json({ error: 'Failed to process CDR' }, { status: 422 });
    }

    // Trigger recording upload in background (non-blocking)
    processPendingRecordings(1).catch((err) => {
      logger.error('[CDR Webhook] Background recording upload failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return NextResponse.json({ callLogId }, { status: 201 });
  } catch (error) {
    logger.error('[CDR Webhook] Error processing CDR', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
