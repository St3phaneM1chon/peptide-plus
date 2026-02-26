export const dynamic = 'force-dynamic';

/**
 * GET /api/tracking/click?eid=ENCODED_EMAIL_LOG_ID&url=ENCODED_URL
 *
 * Click tracking endpoint: records the click event and redirects (302)
 * to the original destination URL.
 *
 * Security:
 * - Email log IDs are HMAC-encoded to prevent enumeration
 * - URL must be http:// or https:// (prevents open redirect to javascript:, data:, etc.)
 * - URL must not redirect back to the tracking endpoint (prevents loops)
 * - Validates URL against a reasonable length limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decodeTrackingId } from '@/lib/email/tracking';
import { logger } from '@/lib/logger';

const MAX_URL_LENGTH = 4096;

/**
 * Validate that a URL is safe to redirect to.
 * Must be http:// or https:// and not point back to our tracking endpoints.
 */
function isValidRedirectUrl(url: string): boolean {
  // Length check
  if (url.length > MAX_URL_LENGTH) return false;

  // Must be http or https
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

  try {
    const parsed = new URL(url);
    // Block non-http protocols that might have slipped through string check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    // Block redirect loops to our own tracking endpoints
    if (parsed.pathname.startsWith('/api/tracking/')) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const eid = request.nextUrl.searchParams.get('eid');
    const encodedUrl = request.nextUrl.searchParams.get('url');

    if (!eid || !encodedUrl) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Decode the URL
    const url = decodeURIComponent(encodedUrl);

    // Validate URL safety BEFORE any database operations
    if (!isValidRedirectUrl(url)) {
      logger.warn('[click-tracking] Invalid redirect URL blocked', { url: url.slice(0, 100) });
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Decode and verify the tracking ID
    const emailLogId = decodeTrackingId(eid);
    if (!emailLogId) {
      // Invalid tracking ID - still redirect to avoid breaking the user experience
      return NextResponse.redirect(url, 302);
    }

    // Record the click event (non-blocking - redirect immediately)
    recordClickEvent(emailLogId, url).catch((err) => {
      logger.error('[click-tracking] Failed to record click event', {
        emailLogId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // 302 redirect to the original destination
    return NextResponse.redirect(url, 302);
  } catch (err) {
    logger.error('[click-tracking] Unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Try to redirect to the URL even on error
    const encodedUrl = request.nextUrl.searchParams.get('url');
    if (encodedUrl) {
      try {
        const url = decodeURIComponent(encodedUrl);
        if (isValidRedirectUrl(url)) {
          return NextResponse.redirect(url, 302);
        }
      } catch {
        // Fall through to error response
      }
    }
    return NextResponse.json({ error: 'Tracking error' }, { status: 500 });
  }
}

/**
 * Record click event in EmailLog and EmailEngagement.
 */
async function recordClickEvent(emailLogId: string, clickedUrl: string): Promise<void> {
  const now = new Date();

  // Update EmailLog: increment clickCount, set clickedAt if first click
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    select: { id: true, to: true, clickedAt: true, clickCount: true, templateId: true },
  });

  if (!emailLog) {
    logger.debug('[click-tracking] EmailLog not found', { emailLogId });
    return;
  }

  await prisma.emailLog.update({
    where: { id: emailLogId },
    data: {
      clickedAt: emailLog.clickedAt || now,
      clickCount: { increment: 1 },
      status: 'clicked',
    },
  });

  // Update EmailEngagement
  const engagement = await prisma.emailEngagement.findFirst({
    where: { emailLogId },
  });

  if (engagement) {
    // Append to clickedLinks JSON array
    const existingLinks = (engagement.clickedLinks as Array<{ url: string; clickedAt: string }>) || [];
    const updatedLinks = [...existingLinks, { url: clickedUrl, clickedAt: now.toISOString() }];

    await prisma.emailEngagement.update({
      where: { id: engagement.id },
      data: {
        clickedAt: engagement.clickedAt || now,
        clickCount: { increment: 1 },
        clickedLinks: updatedLinks,
      },
    });
  } else {
    // Create engagement record
    await prisma.emailEngagement.create({
      data: {
        emailLogId,
        recipientEmail: emailLog.to,
        campaignId: emailLog.templateId?.startsWith('campaign:')
          ? emailLog.templateId.replace('campaign:', '')
          : undefined,
        clickedAt: now,
        clickCount: 1,
        clickedLinks: [{ url: clickedUrl, clickedAt: now.toISOString() }],
      },
    });
  }

  // Propagate to campaign stats if applicable
  if (emailLog.templateId?.startsWith('campaign:')) {
    const campaignId = emailLog.templateId.replace('campaign:', '');
    try {
      const jsonPath = '{clicked}';
      await prisma.$executeRaw`
        UPDATE "EmailCampaign"
        SET stats = jsonb_set(
          COALESCE(stats::jsonb, '{}'::jsonb),
          ${jsonPath}::text[],
          (COALESCE((stats::jsonb->>'clicked')::int, 0) + 1)::text::jsonb
        )
        WHERE id = ${campaignId}
      `;
    } catch (err) {
      logger.warn('[click-tracking] Failed to propagate campaign click stat', {
        campaignId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.debug('[click-tracking] Click recorded', { emailLogId, url: clickedUrl.slice(0, 100) });
}
