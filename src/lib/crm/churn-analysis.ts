/**
 * Churn Analysis Engine (J19)
 * Calculates churn rates, identifies at-risk customers, and generates predictions.
 */

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChurnRateResult {
  period: string;
  startCustomers: number;
  endCustomers: number;
  churned: number;
  churnRate: number;
}

export interface AtRiskCustomer {
  id: string;
  name: string;
  email: string;
  lastOrderDate: string | null;
  daysSinceLastOrder: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  totalRevenue: number;
  orderCount: number;
  signals: string[];
}

export interface ChurnPrediction {
  contactId: string;
  churnProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  recommendedActions: string[];
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculate churn rate for a given period (in months).
 * Churn = customers who had orders before the period but none during.
 */
export async function calculateChurnRate(months: number = 3): Promise<ChurnRateResult[]> {
  const now = new Date();

  // Build all period boundaries first, then execute all queries in parallel
  const periods: Array<{ periodStart: Date; periodEnd: Date; prePeriod: Date }> = [];
  for (let i = 0; i < 6; i++) {
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() - i * months);
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - months);
    const prePeriod = new Date(periodStart);
    prePeriod.setMonth(prePeriod.getMonth() - months);
    periods.push({ periodStart, periodEnd, prePeriod });
  }

  // Execute all 12 queries (2 per period) in parallel instead of sequentially
  const queryResults = await Promise.all(
    periods.map(({ periodStart, periodEnd, prePeriod }) =>
      Promise.all([
        prisma.user.count({
          where: {
            orders: { some: { createdAt: { gte: prePeriod, lt: periodStart }, status: { not: 'CANCELLED' } } },
          },
        }),
        prisma.user.count({
          where: {
            orders: {
              some: {
                createdAt: { gte: prePeriod, lt: periodStart },
                status: { not: 'CANCELLED' },
              },
            },
            AND: {
              orders: {
                some: {
                  createdAt: { gte: periodStart, lt: periodEnd },
                  status: { not: 'CANCELLED' },
                },
              },
            },
          },
        }),
      ])
    )
  );

  const results: ChurnRateResult[] = queryResults.map(([activeBefore, stillActive], i) => {
    const { periodStart, periodEnd } = periods[i];
    const churned = activeBefore - stillActive;
    const churnRate = activeBefore > 0 ? Math.round((churned / activeBefore) * 10000) / 100 : 0;

    return {
      period: `${periodStart.toISOString().slice(0, 7)} - ${periodEnd.toISOString().slice(0, 7)}`,
      startCustomers: activeBefore,
      endCustomers: stillActive,
      churned,
      churnRate,
    };
  });

  return results.reverse();
}

/**
 * Identify at-risk customers based on engagement signals.
 */
export async function identifyAtRiskCustomers(limit: number = 50): Promise<AtRiskCustomer[]> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

  // Customers with past orders but none in last 90 days
  const candidates = await prisma.user.findMany({
    where: {
      orders: { some: { status: { not: 'CANCELLED' } } },
      NOT: { orders: { some: { createdAt: { gte: ninetyDaysAgo }, status: { not: 'CANCELLED' } } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      orders: {
        where: { status: { not: 'CANCELLED' } },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    take: limit * 2,
  });

  const results: AtRiskCustomer[] = [];

  for (const user of candidates) {
    const lastOrder = user.orders[0];
    const daysSince = lastOrder
      ? Math.round((now.getTime() - lastOrder.createdAt.getTime()) / 86400000)
      : 999;

    const totalRevenue = user.orders.reduce((s, o) => s + Number(o.total), 0);
    const orderCount = user.orders.length;

    // Risk signals
    const signals: string[] = [];
    if (daysSince > 180) signals.push('No order in 6+ months');
    else if (daysSince > 90) signals.push('No order in 3+ months');
    if (orderCount <= 1) signals.push('Single purchase customer');
    if (totalRevenue < 100) signals.push('Low lifetime spend');

    // Risk score (0-100)
    let riskScore = Math.min(100, Math.round(daysSince / 3.65));
    if (orderCount <= 1) riskScore = Math.min(100, riskScore + 15);
    if (totalRevenue < 100) riskScore = Math.min(100, riskScore + 10);

    const riskLevel: AtRiskCustomer['riskLevel'] =
      riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';

    results.push({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      lastOrderDate: lastOrder?.createdAt.toISOString() || null,
      daysSinceLastOrder: daysSince,
      riskScore,
      riskLevel,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      orderCount,
      signals,
    });
  }

  return results.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
}

/**
 * Generate churn prediction for a specific contact.
 */
export async function getChurnPrediction(contactId: string): Promise<ChurnPrediction | null> {
  const user = await prisma.user.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      orders: {
        where: { status: { not: 'CANCELLED' } },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) return null;

  const now = new Date();
  const factors: string[] = [];
  const actions: string[] = [];
  let probability = 0.1;

  const lastOrder = user.orders[0];
  const daysSince = lastOrder ? (now.getTime() - lastOrder.createdAt.getTime()) / 86400000 : 365;

  if (daysSince > 180) { probability += 0.4; factors.push('No purchase in 6+ months'); actions.push('Send win-back campaign'); }
  else if (daysSince > 90) { probability += 0.25; factors.push('No purchase in 3+ months'); actions.push('Send re-engagement email'); }
  else if (daysSince > 60) { probability += 0.1; factors.push('Declining purchase frequency'); actions.push('Offer loyalty discount'); }

  if (user.orders.length <= 1) { probability += 0.2; factors.push('Single purchase only'); actions.push('Send product recommendations'); }
  if (user.orders.length >= 5) { probability -= 0.1; }

  const totalRevenue = user.orders.reduce((s, o) => s + Number(o.total), 0);
  if (totalRevenue < 50) { probability += 0.1; factors.push('Very low lifetime spend'); }

  probability = Math.min(0.95, Math.max(0.05, probability));

  const riskLevel: ChurnPrediction['riskLevel'] =
    probability >= 0.7 ? 'CRITICAL' : probability >= 0.5 ? 'HIGH' : probability >= 0.3 ? 'MEDIUM' : 'LOW';

  return {
    contactId,
    churnProbability: Math.round(probability * 100) / 100,
    riskLevel,
    factors,
    recommendedActions: actions,
  };
}
