export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Customer Health Score API
// Returns a composite 0-100 health score for a given customer, based on:
//   - Order frequency (last 90 days vs lifetime average)
//   - Total spend trend (last 90 days vs prior 90 days)
//   - Loyalty tier
//   - Days since last order (recency)
//   - Review activity
//   - Return rate

// ─── Types ───────────────────────────────────────────────────────────────────

interface HealthFactor {
  name: string;
  value: number;   // 0–100 (normalised sub-score for this factor)
  weight: number;  // 0–1, all weights sum to 1.0
}

interface HealthScoreResponse {
  score: number;
  factors: HealthFactor[];
  trend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Clamp a number to [0, 100]. */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Score loyalty tier: BRONZE=20, SILVER=40, GOLD=65, PLATINUM=85, DIAMOND=100 */
function loyaltyTierScore(tier: string): number {
  const map: Record<string, number> = {
    BRONZE: 20,
    SILVER: 40,
    GOLD: 65,
    PLATINUM: 85,
    DIAMOND: 100,
  };
  return map[tier?.toUpperCase()] ?? 20;
}

/**
 * Score recency (days since last order).
 *   0 days  → 100
 *  30 days  →  80
 *  60 days  →  60
 *  90 days  →  40
 * 180 days  →  20
 * 365+ days →   0
 */
function recencyScore(daysSinceLastOrder: number): number {
  if (daysSinceLastOrder <= 0) return 100;
  if (daysSinceLastOrder >= 365) return 0;
  return clamp(100 - (daysSinceLastOrder / 365) * 100);
}

/**
 * Frequency score: ratio of recent orders/month vs lifetime orders/month.
 * Ratio >= 1 → 100, ratio = 0.5 → 50, ratio = 0 → 0.
 */
function frequencyRatioScore(recentOrdersPerMonth: number, lifetimeOrdersPerMonth: number): number {
  if (lifetimeOrdersPerMonth === 0) {
    // No lifetime baseline yet — use recent activity alone
    return clamp(recentOrdersPerMonth > 0 ? 60 : 20);
  }
  const ratio = recentOrdersPerMonth / lifetimeOrdersPerMonth;
  return clamp(ratio * 100);
}

/**
 * Spend trend score: compare last-90-day spend vs prior-90-day spend.
 * +50 % or more → 100, flat → 60, −50 % or more → 0.
 */
function spendTrendScore(recentSpend: number, priorSpend: number): number {
  if (priorSpend === 0 && recentSpend === 0) return 50; // no data
  if (priorSpend === 0) return 80; // first purchases in recent window
  const changePct = (recentSpend - priorSpend) / priorSpend; // −1 → +∞
  // Map [-1, +1] onto [0, 100], centred at 60 (flat = 60)
  const normalised = 60 + changePct * 40;
  return clamp(normalised);
}

/**
 * Review activity score: 0 reviews → 0, 1 review → 50, 3+ reviews → 100.
 */
function reviewScore(reviewCount: number): number {
  return clamp(Math.min(reviewCount, 3) / 3 * 100);
}

/**
 * Return-rate score: 0 % returns → 100, 10 % → 80, 30 % → 40, 50 %+ → 0.
 */
function returnRateScore(returnRate: number): number {
  // returnRate is 0..1 (e.g. 0.10 = 10 %)
  return clamp(100 - returnRate * 200);
}

/** Derive trend from comparing score to precomputed sub-components. */
function deriveTrend(
  spendScore: number,
  freqScore: number,
  recencyScoreVal: number,
): 'improving' | 'stable' | 'declining' {
  const avg = (spendScore + freqScore + recencyScoreVal) / 3;
  if (avg >= 65) return 'improving';
  if (avg <= 40) return 'declining';
  return 'stable';
}

/** Map composite score to a risk level. */
function deriveRisk(score: number): 'low' | 'medium' | 'high' {
  if (score >= 65) return 'low';
  if (score >= 40) return 'medium';
  return 'high';
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const GET = withAdminGuard(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { id } = await params;

    // Verify the customer exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        loyaltyTier: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // ── Date boundaries ──────────────────────────────────────────────────────
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // ── Parallel data fetch ──────────────────────────────────────────────────
    const [
      allOrders,
      recentOrders,
      priorOrders,
      reviewCount,
      returnRequests,
      customerMetrics,
    ] = await Promise.all([
      // All completed orders (lifetime)
      prisma.order.findMany({
        where: {
          userId: id,
          status: { in: ['DELIVERED', 'SHIPPED', 'PROCESSING', 'COMPLETED'] },
        },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: 'desc' },
      }),

      // Orders in the last 90 days
      prisma.order.aggregate({
        where: {
          userId: id,
          createdAt: { gte: ninetyDaysAgo },
          status: { in: ['DELIVERED', 'SHIPPED', 'PROCESSING', 'COMPLETED'] },
        },
        _count: { id: true },
        _sum: { total: true },
      }),

      // Orders in the prior 90-day window (90–180 days ago)
      prisma.order.aggregate({
        where: {
          userId: id,
          createdAt: { gte: oneEightyDaysAgo, lt: ninetyDaysAgo },
          status: { in: ['DELIVERED', 'SHIPPED', 'PROCESSING', 'COMPLETED'] },
        },
        _count: { id: true },
        _sum: { total: true },
      }),

      // Total approved reviews written by this customer
      prisma.review.count({
        where: { userId: id, isApproved: true },
      }),

      // Return requests for this customer
      prisma.returnRequest.findMany({
        where: { userId: id },
        select: { id: true, orderId: true },
      }),

      // Pre-computed metrics (may not exist yet)
      prisma.customerMetrics.findUnique({
        where: { userId: id },
        select: {
          churnScore: true,
          rfmSegment: true,
          lastOrderDays: true,
          orderFrequency: true,
          totalOrders: true,
          totalSpent: true,
          recencyScore: true,
          frequencyScore: true,
          monetaryScore: true,
        },
      }),
    ]);

    // ── Derived values ────────────────────────────────────────────────────────

    // Days since last order
    let daysSinceLastOrder = 9999;
    if (customerMetrics?.lastOrderDays !== undefined) {
      daysSinceLastOrder = customerMetrics.lastOrderDays;
    } else if (allOrders.length > 0) {
      const msAgo = now.getTime() - allOrders[0].createdAt.getTime();
      daysSinceLastOrder = Math.floor(msAgo / (24 * 60 * 60 * 1000));
    }

    // Lifetime metrics
    const lifetimeTotalOrders = allOrders.length;
    const accountAgeDays = Math.max(
      1,
      Math.floor((now.getTime() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const lifetimeOrdersPerMonth =
      customerMetrics?.orderFrequency !== undefined && Number(customerMetrics.orderFrequency) > 0
        ? 30 / Number(customerMetrics.orderFrequency) // orderFrequency = avg days between orders
        : (lifetimeTotalOrders / accountAgeDays) * 30;

    // Recent period
    const recentOrderCount = recentOrders._count.id;
    const recentSpend = Number(recentOrders._sum.total ?? 0);
    const recentOrdersPerMonth = (recentOrderCount / 90) * 30;

    // Prior period
    const priorSpend = Number(priorOrders._sum.total ?? 0);

    // Return rate (distinct orders with a return vs total orders)
    const ordersWithReturn = new Set(returnRequests.map((r) => r.orderId)).size;
    const returnRate = lifetimeTotalOrders > 0 ? ordersWithReturn / lifetimeTotalOrders : 0;

    // ── Sub-scores ────────────────────────────────────────────────────────────

    const freqScore = frequencyRatioScore(recentOrdersPerMonth, lifetimeOrdersPerMonth);
    const spendScore = spendTrendScore(recentSpend, priorSpend);
    const tierScore = loyaltyTierScore(user.loyaltyTier ?? 'BRONZE');
    const recencyScoreVal = recencyScore(daysSinceLastOrder);
    const reviewScoreVal = reviewScore(reviewCount);
    const returnScoreVal = returnRateScore(returnRate);

    // Weights must sum to 1.0
    const factors: HealthFactor[] = [
      { name: 'Order Frequency',   value: clamp(freqScore),       weight: 0.25 },
      { name: 'Spend Trend',       value: clamp(spendScore),      weight: 0.20 },
      { name: 'Loyalty Tier',      value: clamp(tierScore),       weight: 0.15 },
      { name: 'Recency',           value: clamp(recencyScoreVal), weight: 0.20 },
      { name: 'Review Activity',   value: clamp(reviewScoreVal),  weight: 0.10 },
      { name: 'Return Rate',       value: clamp(returnScoreVal),  weight: 0.10 },
    ];

    // Weighted composite score
    const rawScore = factors.reduce(
      (sum, f) => sum + f.value * f.weight,
      0,
    );
    const score = Math.round(clamp(rawScore));

    const trend = deriveTrend(spendScore, freqScore, recencyScoreVal);
    const riskLevel = deriveRisk(score);

    logger.info('Customer health score calculated', {
      customerId: id,
      score,
      trend,
      riskLevel,
      daysSinceLastOrder,
      recentOrderCount,
    });

    const body: HealthScoreResponse = { score, factors, trend, riskLevel };
    return NextResponse.json(body);
  },
  { skipCsrf: true },
);
