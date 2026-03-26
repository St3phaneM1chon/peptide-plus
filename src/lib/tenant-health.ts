/**
 * Tenant Health Score — Koraline SaaS
 * Computes a 0-100 health score based on engagement signals.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface HealthSignal {
  key: string;
  label: string;
  value: boolean;
  impact: number; // positive = bonus, negative = penalty
}

export interface TenantHealth {
  score: number;       // 0-100
  grade: HealthGrade;
  signals: HealthSignal[];
}

// ---------------------------------------------------------------------------
// Grade mapping
// ---------------------------------------------------------------------------

function scoreToGrade(score: number): HealthGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export const GRADE_COLORS: Record<HealthGrade, { bg: string; text: string }> = {
  A: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
  B: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  C: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
  D: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c' },
  F: { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185' },
};

// ---------------------------------------------------------------------------
// Compute health score for a single tenant
// ---------------------------------------------------------------------------

export async function computeHealthScore(tenantId: string): Promise<TenantHealth> {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [tenant, userCount, productCount, recentOrderCount, recentLoginEvent] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeSubscriptionId: true,
          onboardingCompleted: true,
          modulesEnabled: true,
        },
      }),
      prisma.user.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.order.count({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.tenantEvent.findFirst({
        where: { tenantId, type: 'LOGIN', createdAt: { gte: sevenDaysAgo } },
        select: { id: true },
      }),
    ]);

    if (!tenant) {
      return { score: 0, grade: 'F', signals: [] };
    }

    // Check for recent login from owner/users (fallback: check if any user has recentLogin event)
    const isActive = Boolean(recentLoginEvent);
    const noLoginThirtyDays = !recentLoginEvent && userCount > 0;
    const hasPayment = Boolean(tenant.stripeSubscriptionId);
    const hasProducts = productCount > 0;
    const hasRecentOrders = recentOrderCount > 0;
    const onboardingDone = Boolean(tenant.onboardingCompleted);

    let modules: string[] = [];
    try {
      modules = Array.isArray(tenant.modulesEnabled)
        ? (tenant.modulesEnabled as string[])
        : JSON.parse(tenant.modulesEnabled as string);
    } catch (err) {
      logger.error('Corrupt modulesEnabled for tenant', { tenantId, raw: String(tenant.modulesEnabled), error: err instanceof Error ? err.message : String(err) });
    }
    const hasMultipleModules = modules.length > 3;

    // Build signals
    const signals: HealthSignal[] = [
      { key: 'active', label: 'Connexion recente (< 7 jours)', value: isActive, impact: isActive ? 30 : 0 },
      { key: 'payment', label: 'Paiement a jour', value: hasPayment, impact: hasPayment ? 20 : 0 },
      { key: 'products', label: 'Produits crees', value: hasProducts, impact: hasProducts ? 15 : 0 },
      { key: 'orders', label: 'Commandes (30 derniers jours)', value: hasRecentOrders, impact: hasRecentOrders ? 15 : 0 },
      { key: 'onboarding', label: 'Onboarding complete', value: onboardingDone, impact: onboardingDone ? 10 : 0 },
      { key: 'modules', label: 'Plus de 3 modules actifs', value: hasMultipleModules, impact: hasMultipleModules ? 10 : 0 },
    ];

    // Penalties (only applied if no positive counterpart)
    if (noLoginThirtyDays) {
      signals.push({ key: 'noLogin30d', label: 'Aucune connexion depuis 30+ jours', value: true, impact: -20 });
    }
    if (!hasPayment) {
      signals.push({ key: 'noPayment', label: 'Paiement manquant/echoue', value: true, impact: -30 });
    }

    const rawScore = signals.reduce((sum, s) => sum + s.impact, 0);
    const score = Math.max(0, Math.min(100, rawScore));

    return {
      score,
      grade: scoreToGrade(score),
      signals,
    };
  } catch (error) {
    logger.error('Failed to compute health score', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { score: 0, grade: 'F', signals: [] };
  }
}

// ---------------------------------------------------------------------------
// Batch health scores for all tenants
// ---------------------------------------------------------------------------

export async function computeHealthScoresBatch(): Promise<Map<string, TenantHealth>> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const results = new Map<string, TenantHealth>();

  // Process in batches of 10 to avoid overwhelming the DB
  const batchSize = 10;
  for (let i = 0; i < tenants.length; i += batchSize) {
    const batch = tenants.slice(i, i + batchSize);
    const scores = await Promise.all(
      batch.map(t => computeHealthScore(t.id).then(h => [t.id, h] as const))
    );
    for (const [id, health] of scores) {
      results.set(id, health);
    }
  }

  return results;
}
