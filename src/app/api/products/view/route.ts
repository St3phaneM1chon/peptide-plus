export const dynamic = 'force-dynamic';

/**
 * POST /api/products/view
 *
 * Records a product page view for authenticated users.
 * Used by the browse-abandonment cron to detect users who viewed
 * products 2+ times without adding to cart.
 *
 * Body: { productId: string }
 *
 * Rate-limited: max 1 view per user per product per 5 minutes
 * to avoid duplicate logging on page refreshes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const productViewSchema = z.object({
  productId: z.string().min(1),
});

const DEDUP_MINUTES = 5; // Don't log same product view within 5 minutes

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting on product view tracking
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/products/view');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = productViewSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId } = parsed.data;

    // Dedup: skip if the same user viewed this product within the last N minutes
    const dedupWindow = new Date(Date.now() - DEDUP_MINUTES * 60 * 1000);
    const recentView = await db.productView.findFirst({
      where: {
        userId: session.user.id,
        productId,
        viewedAt: { gte: dedupWindow },
      },
      select: { id: true },
    });

    if (recentView) {
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    // Record the view
    await db.productView.create({
      data: {
        userId: session.user.id,
        productId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[ProductView] Failed to record view', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
