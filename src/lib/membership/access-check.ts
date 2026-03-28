/**
 * Membership Access Check — Content Gating Utility
 *
 * Determines whether a user has access to specific gated content
 * based on their active membership plans.
 *
 * Content access rules use a simple pattern system:
 *   - "blog:*"          → all blog content
 *   - "article:premium" → articles tagged "premium"
 *   - "page:vip-lounge" → specific page slug
 *   - "*"               → all content (full access)
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface AccessCheckResult {
  hasAccess: boolean;
  /** The plan(s) granting access, if any */
  grantingPlans: Array<{ id: string; name: string; slug: string }>;
  /** If no access, the plans that would grant it */
  requiredPlans: Array<{ id: string; name: string; slug: string; price: number; interval: string }>;
}

/**
 * Check if a user has access to a specific content resource.
 *
 * @param userId - The user ID to check
 * @param contentKey - The content identifier (e.g., "blog:premium", "page:vip-lounge")
 * @param tenantId - Optional tenant scope
 */
export async function checkMembershipAccess(
  userId: string | null | undefined,
  contentKey: string,
  tenantId?: string | null
): Promise<AccessCheckResult> {
  try {
    // If no user, check which plans would grant access
    if (!userId) {
      const requiredPlans = await findPlansForContent(contentKey, tenantId);
      return { hasAccess: false, grantingPlans: [], requiredPlans };
    }

    // Find active memberships for this user
    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } },
        ],
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            contentAccess: true,
            isActive: true,
          },
        },
      },
    });

    // Check each membership plan's content access rules
    const grantingPlans: AccessCheckResult['grantingPlans'] = [];

    for (const membership of memberships) {
      if (!membership.plan.isActive) continue;

      const accessRules = membership.plan.contentAccess as string[];
      if (matchesContentAccess(contentKey, accessRules)) {
        grantingPlans.push({
          id: membership.plan.id,
          name: membership.plan.name,
          slug: membership.plan.slug,
        });
      }
    }

    if (grantingPlans.length > 0) {
      return { hasAccess: true, grantingPlans, requiredPlans: [] };
    }

    // No access — find plans that would grant it
    const requiredPlans = await findPlansForContent(contentKey, tenantId);
    return { hasAccess: false, grantingPlans: [], requiredPlans };
  } catch (error) {
    logger.error('[MembershipAccess] Error checking access', {
      userId,
      contentKey,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail closed: deny access on error
    return { hasAccess: false, grantingPlans: [], requiredPlans: [] };
  }
}

/**
 * Match a content key against a list of access rules.
 * Rules support:
 *   "*"            → matches everything
 *   "blog:*"       → matches any key starting with "blog:"
 *   "page:vip"     → exact match for "page:vip"
 */
function matchesContentAccess(contentKey: string, accessRules: string[]): boolean {
  if (!Array.isArray(accessRules)) return false;

  for (const rule of accessRules) {
    if (rule === '*') return true;
    if (rule.endsWith(':*')) {
      const prefix = rule.slice(0, -1); // "blog:" from "blog:*"
      if (contentKey.startsWith(prefix)) return true;
    }
    if (rule === contentKey) return true;
  }

  return false;
}

/**
 * Find all active plans that grant access to a given content key.
 * Used to show the user what plans they could subscribe to.
 */
async function findPlansForContent(
  contentKey: string,
  tenantId?: string | null
): Promise<AccessCheckResult['requiredPlans']> {
  const plans = await prisma.membershipPlan.findMany({
    where: {
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      interval: true,
      contentAccess: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  return plans
    .filter((plan) => matchesContentAccess(contentKey, plan.contentAccess as string[]))
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      price: Number(plan.price),
      interval: plan.interval,
    }));
}

/**
 * Get all active membership plans for display (e.g., pricing page).
 */
export async function getActiveMembershipPlans(tenantId?: string | null) {
  return prisma.membershipPlan.findMany({
    where: {
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      currency: true,
      interval: true,
      features: true,
      trialDays: true,
      stripePriceId: true,
    },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Get user's active memberships.
 */
export async function getUserMemberships(userId: string) {
  return prisma.membership.findMany({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
      OR: [
        { endDate: null },
        { endDate: { gt: new Date() } },
      ],
    },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          features: true,
          contentAccess: true,
          interval: true,
          price: true,
          currency: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
