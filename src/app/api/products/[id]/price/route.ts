export const dynamic = 'force-dynamic';

/**
 * Public Product Price API
 * GET - Returns the effective price for a product based on the authenticated
 *       user's loyalty tier (or BRONZE for anonymous users).
 *
 * Query params:
 *   tier (optional) - Override tier for price simulation (admin debugging)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getEffectivePrice } from '@/lib/pricing';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: productId } = await context.params;

    if (!productId) {
      return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
    }

    // Determine the user's tier
    let tierName = 'BRONZE';
    const session = await auth();

    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { loyaltyTier: true },
      });
      if (user?.loyaltyTier) {
        tierName = user.loyaltyTier;
      }
    }

    // Allow tier override via query param (for admin simulation / testing)
    const overrideTier = new URL(request.url).searchParams.get('tier');
    if (overrideTier) {
      tierName = overrideTier.toUpperCase();
    }

    const result = await getEffectivePrice(productId, tierName);

    const response = NextResponse.json({
      productId,
      tierName: result.tierName,
      basePrice: Number(result.basePrice),
      effectivePrice: Number(result.effectivePrice),
      discountPercent: Number(result.discountPercent),
      savings: Number(result.savings),
      hasTierPrice: result.tierPrice !== null,
    });

    // Cache for 60 seconds, allow stale-while-revalidate for 30s
    response.headers.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=60, stale-while-revalidate=30'
    );

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Product not found')) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    logger.error('Product price GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
