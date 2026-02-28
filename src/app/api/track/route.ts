export const dynamic = 'force-dynamic';

/**
 * Public Content Tracking API
 * C-07: Records views, clicks, shares, conversions for analytics.
 * POST /api/track - Record an interaction event
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackInteraction } from '@/lib/media/content-analytics';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const trackSchema = z.object({
  contentId: z.string().min(1).max(100),
  contentType: z.enum(['video', 'social_post', 'media']),
  action: z.enum(['view', 'click', 'share', 'conversion']),
  sessionId: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIpFromRequest(request);

    // Rate limit: 100 events/minute per IP
    const rl = await rateLimitMiddleware(ip, '/api/track', undefined);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: rl.headers });
    }

    const body = await request.json();
    const parsed = trackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    await trackInteraction({
      ...parsed.data,
      ip,
      referrer: request.headers.get('referer') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
