export const dynamic = 'force-dynamic';

/**
 * GET /api/tracking/email?eid=ENCODED_EMAIL_LOG_ID
 *
 * Tracking pixel endpoint: serves a 1x1 transparent GIF and records
 * the email open event in the database.
 *
 * Security:
 * - Email log IDs are HMAC-encoded to prevent enumeration
 * - Rate limited: same IP can only trigger one open per email per 5 minutes
 * - Cache-Control: no-store to allow re-tracking (but rate-limited)
 * - Does not track if email was already opened (idempotent openedAt)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decodeTrackingId } from '@/lib/email/tracking';
import { logger } from '@/lib/logger';

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// In-memory rate limit: prevent multiple opens from same IP within 5 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const openRateMap = new Map<string, number>(); // key: "emailLogId:ip" -> timestamp
let cleanupCounter = 0;

function isRateLimited(emailLogId: string, ip: string): boolean {
  const key = `${emailLogId}:${ip}`;
  const now = Date.now();
  const lastOpen = openRateMap.get(key);

  if (lastOpen && now - lastOpen < RATE_LIMIT_WINDOW_MS) {
    return true; // Already counted within window
  }

  openRateMap.set(key, now);

  // Periodic cleanup every 500 requests
  cleanupCounter++;
  if (cleanupCounter % 500 === 0) {
    for (const [k, ts] of openRateMap) {
      if (now - ts > RATE_LIMIT_WINDOW_MS) {
        openRateMap.delete(k);
      }
    }
  }

  return false;
}

function getGifResponse(): NextResponse {
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(request: NextRequest) {
  // Always return the GIF (even on error) to avoid broken images in emails
  try {
    const eid = request.nextUrl.searchParams.get('eid');
    if (!eid) {
      return getGifResponse();
    }

    // Decode and verify the tracking ID
    const emailLogId = decodeTrackingId(eid);
    if (!emailLogId) {
      return getGifResponse();
    }

    // Extract client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '0.0.0.0';

    // Rate limit: don't count multiple opens from same IP within 5 minutes
    if (isRateLimited(emailLogId, ip)) {
      return getGifResponse();
    }

    // Validate request has reasonable headers (basic bot filtering)
    const userAgent = request.headers.get('user-agent') || '';
    // Skip tracking for known prefetchers/bots that don't represent real opens
    const isPrefetcher = /googleimageproxy|yahoo.*slurp|bingpreview/i.test(userAgent);

    // Record the open event (non-blocking - don't delay the GIF response)
    recordOpenEvent(emailLogId, isPrefetcher).catch((err) => {
      logger.error('[tracking-pixel] Failed to record open event', {
        emailLogId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return getGifResponse();
  } catch (err) {
    logger.error('[tracking-pixel] Unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return getGifResponse();
  }
}

/**
 * Record email open event in both EmailLog and EmailEngagement.
 */
async function recordOpenEvent(emailLogId: string, isPrefetcher: boolean): Promise<void> {
  const now = new Date();

  // Update EmailLog: set openedAt only if not already set, update status
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    select: { id: true, to: true, openedAt: true, templateId: true },
  });

  if (!emailLog) {
    logger.debug('[tracking-pixel] EmailLog not found', { emailLogId });
    return;
  }

  // Don't overwrite first open timestamp, but always update status
  const updates: Record<string, unknown> = {};
  if (!emailLog.openedAt && !isPrefetcher) {
    updates.openedAt = now;
  }
  if (emailLog.openedAt === null || emailLog.openedAt === undefined) {
    updates.status = 'opened';
  }

  if (Object.keys(updates).length > 0) {
    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: updates,
    });
  }

  // Update EmailEngagement if it exists for this email log
  if (!isPrefetcher) {
    const engagement = await prisma.emailEngagement.findFirst({
      where: { emailLogId },
    });

    if (engagement) {
      await prisma.emailEngagement.update({
        where: { id: engagement.id },
        data: {
          openedAt: engagement.openedAt || now,
          openCount: { increment: 1 },
        },
      });
    } else {
      // Create engagement record if one doesn't exist yet
      await prisma.emailEngagement.create({
        data: {
          emailLogId,
          recipientEmail: emailLog.to,
          campaignId: emailLog.templateId?.startsWith('campaign:')
            ? emailLog.templateId.replace('campaign:', '')
            : undefined,
          subject: undefined, // Could be populated but would require another query
          openedAt: now,
          openCount: 1,
        },
      });
    }
  }

  // Propagate to campaign stats if applicable
  if (emailLog.templateId?.startsWith('campaign:')) {
    const campaignId = emailLog.templateId.replace('campaign:', '');
    try {
      const jsonPath = '{opened}';
      await prisma.$executeRaw`
        UPDATE "EmailCampaign"
        SET stats = jsonb_set(
          COALESCE(stats::jsonb, '{}'::jsonb),
          ${jsonPath}::text[],
          (COALESCE((stats::jsonb->>'opened')::int, 0) + 1)::text::jsonb
        )
        WHERE id = ${campaignId}
      `;
    } catch (err) {
      logger.warn('[tracking-pixel] Failed to propagate campaign open stat', {
        campaignId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.debug('[tracking-pixel] Open recorded', { emailLogId, isPrefetcher });
}
