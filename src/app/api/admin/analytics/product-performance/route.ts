export const dynamic = 'force-dynamic';

/**
 * Cross-Module Analytics #5: Product 360 Performance
 * GET /api/admin/analytics/product-performance
 *
 * Aggregates product data across Commerce + Community + Marketing + Media.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess } from '@/lib/api-response';
import { getModuleFlags } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params: _params }: { session: unknown; params: Promise<{ id?: string }> }
) => {
  const flags = await getModuleFlags(['ecommerce', 'community', 'marketing', 'media']);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // ── Sales data per product ──
  type ProductSales = { productId: string; productName: string; _sum: { total: number | null; quantity: number | null }; _count: { id: number } };
  let salesByProduct: ProductSales[] = [];

  if (flags.ecommerce) {
    salesByProduct = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { createdAt: { gte: since } },
      _sum: { total: true, quantity: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    }) as unknown as ProductSales[];
  }

  const productIds = salesByProduct.map((s) => s.productId);

  // ── Reviews per product ──
  let reviewMap = new Map<string, { count: number; avgRating: number }>();
  if (flags.community && productIds.length > 0) {
    const reviewData = await prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _count: { id: true },
      _avg: { rating: true },
    });
    for (const r of reviewData) {
      if (r.productId) {
        reviewMap.set(r.productId, {
          count: r._count.id,
          avgRating: Math.round((r._avg.rating ?? 0) * 10) / 10,
        });
      }
    }
  }

  // ── Active promos per product ──
  let promoMap = new Map<string, number>();
  if (flags.marketing && productIds.length > 0) {
    const now = new Date();
    const promos = await prisma.promoCode.findMany({
      where: {
        isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      select: { productIds: true },
    });
    for (const promo of promos) {
      if (promo.productIds) {
        try {
          const ids: string[] = typeof promo.productIds === 'string'
            ? JSON.parse(promo.productIds)
            : [];
          for (const pid of ids) {
            if (productIds.includes(pid)) {
              promoMap.set(pid, (promoMap.get(pid) || 0) + 1);
            }
          }
        } catch { /* skip invalid JSON */ }
      }
    }
  }

  // ── Video links per product ──
  let videoMap = new Map<string, number>();
  if (flags.media && productIds.length > 0) {
    const videoLinks = await prisma.videoProductLink.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _count: { id: true },
    });
    for (const vl of videoLinks) {
      videoMap.set(vl.productId, vl._count.id);
    }
  }

  // ── Build composite product data ──
  const products = salesByProduct.map((s) => {
    const reviews = reviewMap.get(s.productId);
    return {
      productId: s.productId,
      name: s.productName,
      revenue: Math.round(Number(s._sum.total ?? 0) * 100) / 100,
      unitsSold: s._sum.quantity ?? 0,
      orderCount: s._count.id,
      avgRating: reviews?.avgRating ?? null,
      reviewCount: reviews?.count ?? 0,
      activePromos: promoMap.get(s.productId) ?? 0,
      videoCount: videoMap.get(s.productId) ?? 0,
    };
  });

  // ── Summary ──
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalUnits = products.reduce((s, p) => s + p.unitsSold, 0);
  const avgRating = products.filter((p) => p.avgRating !== null).length > 0
    ? products.filter((p) => p.avgRating !== null).reduce((s, p) => s + (p.avgRating ?? 0), 0) / products.filter((p) => p.avgRating !== null).length
    : null;

  return apiSuccess({
    period: { days, since: since.toISOString() },
    summary: {
      productsAnalyzed: products.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalUnitsSold: totalUnits,
      avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    },
    products,
    modules: flags,
  }, { request });
});
