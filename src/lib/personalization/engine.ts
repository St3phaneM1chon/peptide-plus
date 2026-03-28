/**
 * Personalization Engine — Koraline
 *
 * Tracks visitor behavior (pages viewed, products browsed, time spent),
 * segments visitors (new, returning, high-value, at-risk), and returns
 * personalized recommendations based on behavior + active rules.
 *
 * Usage:
 *   import { trackEvent, getRecommendations, segmentVisitor } from '@/lib/personalization/engine';
 *   await trackEvent(tenantId, visitorId, 'product_view', '/products/abc');
 *   const recs = await getRecommendations(tenantId, visitorId);
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VisitorSegment = 'new_visitor' | 'returning' | 'high_value' | 'at_risk' | 'frequent' | 'browser';

export type EventType = 'page_view' | 'product_view' | 'add_to_cart' | 'purchase' | 'search' | 'click';

export interface TrackEventInput {
  tenantId: string;
  visitorId: string;
  userId?: string;
  type: EventType;
  target?: string;
  metadata?: Record<string, unknown>;
}

export interface PersonalizationAction {
  ruleId: string;
  name: string;
  action: string;
  config: Record<string, unknown>;
  priority: number;
}

export interface Recommendation {
  type: 'product' | 'category' | 'content';
  id: string;
  reason: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Segmentation thresholds
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  NEW_VISITOR_MAX_VIEWS: 3,
  RETURNING_MIN_VISITS: 2,
  HIGH_VALUE_MIN_PURCHASES: 3,
  AT_RISK_INACTIVE_DAYS: 30,
  FREQUENT_MIN_VISITS_WEEK: 5,
  BROWSER_MIN_VIEWS_NO_CART: 10,
} as const;

// ---------------------------------------------------------------------------
// Track Event
// ---------------------------------------------------------------------------

/**
 * Record a visitor event and update the visitor profile.
 * Creates the profile if it does not exist (upsert).
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  const { tenantId, visitorId, userId, type, target, metadata } = input;

  try {
    // Upsert visitor profile
    const profile = await prisma.visitorProfile.upsert({
      where: { tenantId_visitorId: { tenantId, visitorId } },
      create: {
        tenantId,
        visitorId,
        userId: userId || null,
        pageViews: type === 'page_view' ? 1 : 0,
        lastVisit: new Date(),
        firstVisit: new Date(),
        segments: JSON.stringify(['new_visitor']),
        metadata: JSON.stringify({
          lastProducts: [],
          lastCategories: [],
          lastSearches: [],
          purchaseCount: 0,
        }),
      },
      update: {
        lastVisit: new Date(),
        userId: userId || undefined,
        pageViews: type === 'page_view' ? { increment: 1 } : undefined,
        totalTimeMs: metadata?.duration
          ? { increment: Number(metadata.duration) }
          : undefined,
      },
    });

    // Record the event
    await prisma.visitorEvent.create({
      data: {
        tenantId,
        visitorId,
        profileId: profile.id,
        type,
        target: target || null,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
      },
    });

    // Update metadata (last products, categories, searches)
    const existingMeta = safeParseJson(profile.metadata);
    const updatedMeta = { ...existingMeta };

    if (type === 'product_view' && target) {
      const lastProducts = (updatedMeta.lastProducts as string[]) || [];
      updatedMeta.lastProducts = [target, ...lastProducts.filter((p: string) => p !== target)].slice(0, 20);
    }

    if (type === 'search' && target) {
      const lastSearches = (updatedMeta.lastSearches as string[]) || [];
      updatedMeta.lastSearches = [target, ...lastSearches.filter((s: string) => s !== target)].slice(0, 10);
    }

    if (type === 'purchase') {
      updatedMeta.purchaseCount = ((updatedMeta.purchaseCount as number) || 0) + 1;
      updatedMeta.lastPurchaseAt = new Date().toISOString();
    }

    // Re-segment the visitor
    const segments = computeSegments(profile, updatedMeta, type);
    updatedMeta.lastEventType = type;

    await prisma.visitorProfile.update({
      where: { id: profile.id },
      data: {
        metadata: JSON.stringify(updatedMeta),
        segments: JSON.stringify(segments),
      },
    });
  } catch (error) {
    logger.error('[personalization] Failed to track event', {
      visitorId,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Segment Computation
// ---------------------------------------------------------------------------

/**
 * Compute which segments a visitor belongs to based on their profile + metadata.
 */
function computeSegments(
  profile: { pageViews: number; firstVisit: Date; lastVisit: Date; totalTimeMs: number },
  metadata: Record<string, unknown>,
  latestEventType: EventType,
): VisitorSegment[] {
  const segments: VisitorSegment[] = [];
  const now = new Date();
  const daysSinceFirst = (now.getTime() - new Date(profile.firstVisit).getTime()) / (1000 * 60 * 60 * 24);
  const daysSinceLast = (now.getTime() - new Date(profile.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
  const purchaseCount = (metadata.purchaseCount as number) || 0;

  // New visitor: few page views and recent first visit
  if (profile.pageViews <= THRESHOLDS.NEW_VISITOR_MAX_VIEWS && daysSinceFirst < 1) {
    segments.push('new_visitor');
  }

  // Returning: visited before (more than 1 day ago)
  if (daysSinceFirst >= 1) {
    segments.push('returning');
  }

  // High value: multiple purchases
  if (purchaseCount >= THRESHOLDS.HIGH_VALUE_MIN_PURCHASES) {
    segments.push('high_value');
  }

  // At risk: had purchases but inactive
  if (purchaseCount > 0 && daysSinceLast >= THRESHOLDS.AT_RISK_INACTIVE_DAYS) {
    segments.push('at_risk');
  }

  // Frequent: lots of recent visits
  if (profile.pageViews > THRESHOLDS.FREQUENT_MIN_VISITS_WEEK && daysSinceLast < 7) {
    segments.push('frequent');
  }

  // Browser: many views but no cart/purchase
  if (
    profile.pageViews >= THRESHOLDS.BROWSER_MIN_VIEWS_NO_CART &&
    purchaseCount === 0 &&
    latestEventType !== 'add_to_cart'
  ) {
    segments.push('browser');
  }

  return segments.length > 0 ? segments : ['new_visitor'];
}

/**
 * Manually re-segment a visitor profile.
 */
export async function segmentVisitor(tenantId: string, visitorId: string): Promise<VisitorSegment[]> {
  const profile = await prisma.visitorProfile.findUnique({
    where: { tenantId_visitorId: { tenantId, visitorId } },
  });

  if (!profile) return ['new_visitor'];

  const metadata = safeParseJson(profile.metadata);
  const segments = computeSegments(profile, metadata, 'page_view');

  await prisma.visitorProfile.update({
    where: { id: profile.id },
    data: { segments: JSON.stringify(segments) },
  });

  return segments;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

/**
 * Get personalized recommendations for a visitor based on:
 * 1. Their browsing history (recently viewed products)
 * 2. Active personalization rules matching their segments
 * 3. Popular products they haven't seen
 */
export async function getRecommendations(
  tenantId: string,
  visitorId: string,
  limit: number = 10,
): Promise<{ actions: PersonalizationAction[]; recommendations: Recommendation[] }> {
  const profile = await prisma.visitorProfile.findUnique({
    where: { tenantId_visitorId: { tenantId, visitorId } },
  });

  if (!profile) {
    return { actions: [], recommendations: [] };
  }

  const segments: string[] = safeParseArray(profile.segments);
  const metadata = safeParseJson(profile.metadata);

  // 1. Get matching personalization rules
  const now = new Date();
  const rules = await prisma.personalizationRule.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { segment: { in: segments } },
        { segment: 'all' },
      ],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { priority: 'desc' },
    take: 5,
  });

  const actions: PersonalizationAction[] = rules.map((r) => ({
    ruleId: r.id,
    name: r.name,
    action: r.action,
    config: safeParseJson(r.config),
    priority: r.priority,
  }));

  // 2. Product recommendations based on browsing history
  const recommendations: Recommendation[] = [];
  const lastProducts = (metadata.lastProducts as string[]) || [];

  if (lastProducts.length > 0) {
    // Find products in the same categories as recently viewed
    try {
      const recentProducts = await prisma.product.findMany({
        where: { id: { in: lastProducts.slice(0, 5) } },
        select: { categoryId: true },
      });

      const categoryIds = [...new Set(recentProducts.map((p) => p.categoryId).filter(Boolean))] as string[];

      if (categoryIds.length > 0) {
        const similar = await prisma.product.findMany({
          where: {
            categoryId: { in: categoryIds },
            id: { notIn: lastProducts },
            isActive: true,
          },
          select: { id: true, name: true },
          take: limit,
          orderBy: { createdAt: 'desc' },
        });

        for (const p of similar) {
          recommendations.push({
            type: 'product',
            id: p.id,
            reason: 'similar_category',
            score: 0.8,
          });
        }
      }
    } catch {
      // Product model may not have viewCount etc — graceful degradation
    }
  }

  // 3. Fill remaining slots with popular products
  if (recommendations.length < limit) {
    try {
      const popular = await prisma.product.findMany({
        where: {
          isActive: true,
          id: { notIn: [...lastProducts, ...recommendations.map((r) => r.id)] },
        },
        select: { id: true, name: true },
        take: limit - recommendations.length,
        orderBy: { createdAt: 'desc' },
      });

      for (const p of popular) {
        recommendations.push({
          type: 'product',
          id: p.id,
          reason: 'popular',
          score: 0.5,
        });
      }
    } catch {
      // Graceful degradation
    }
  }

  return { actions, recommendations };
}

// ---------------------------------------------------------------------------
// Analytics helpers
// ---------------------------------------------------------------------------

/**
 * Get visitor profile summary for admin dashboards.
 */
export async function getVisitorStats(tenantId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalVisitors, activeVisitors, newVisitors, totalEvents] = await Promise.all([
    prisma.visitorProfile.count({ where: { tenantId } }),
    prisma.visitorProfile.count({
      where: { tenantId, lastVisit: { gte: thirtyDaysAgo } },
    }),
    prisma.visitorProfile.count({
      where: { tenantId, firstVisit: { gte: sevenDaysAgo } },
    }),
    prisma.visitorEvent.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  // Segment distribution
  const allProfiles = await prisma.visitorProfile.findMany({
    where: { tenantId, lastVisit: { gte: thirtyDaysAgo } },
    select: { segments: true },
  });

  const segmentCounts: Record<string, number> = {};
  for (const p of allProfiles) {
    const segs: string[] = safeParseArray(p.segments);
    for (const s of segs) {
      segmentCounts[s] = (segmentCounts[s] || 0) + 1;
    }
  }

  return {
    totalVisitors,
    activeVisitors,
    newVisitors,
    totalEvents,
    segmentDistribution: segmentCounts,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function safeParseJson(val: unknown): Record<string, unknown> {
  if (!val) return {};
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return {}; }
  }
  if (typeof val === 'object' && val !== null) return val as Record<string, unknown>;
  return {};
}

function safeParseArray(val: unknown): string[] {
  if (!val) return [];
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  if (Array.isArray(val)) return val as string[];
  return [];
}
