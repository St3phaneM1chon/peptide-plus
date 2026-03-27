export const dynamic = 'force-dynamic';

/**
 * CRON Job - Deal Rotting Detection
 * GET /api/cron/deal-rotting - Find deals stuck in a stage for >14 days
 *
 * Returns deals where the most recent stageHistory entry is older than 14 days
 * and the deal's current stage is not won or lost.
 *
 * Protected by CRON_SECRET env var (Authorization: Bearer <CRON_SECRET>)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';
import { forEachActiveTenant } from '@/lib/tenant-cron';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROTTING_THRESHOLD_DAYS = 14;

// ---------------------------------------------------------------------------
// GET: Detect rotting deals
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('deal-rotting', async () => {
    try {
      // Multi-tenant: iterate over all active tenants
      // Collect results across all tenants
      const allRottingDeals: Array<{
        tenantSlug: string;
        dealId: string;
        title: string;
        assignedTo: { id: string; name: string | null; email: string | null } | null;
        stageName: string;
        daysInStage: number;
      }> = [];

      const tenantResult = await forEachActiveTenant(async (tenant) => {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() - ROTTING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

      // Find deals in non-terminal stages (not won, not lost)
      // Prisma middleware auto-filters by tenant
      const deals = await prisma.crmDeal.findMany({
        where: {
          stage: {
            isWon: false,
            isLost: false,
          },
        },
        include: {
          stage: { select: { name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          stageHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      // Filter to deals whose last stage change is older than threshold
      for (const deal of deals) {
        const lastStageChange = deal.stageHistory[0]?.createdAt;
        if (!lastStageChange) continue;

        if (lastStageChange < thresholdDate) {
          const daysInStage = Math.floor(
            (now.getTime() - lastStageChange.getTime()) / (24 * 60 * 60 * 1000)
          );

          allRottingDeals.push({
            tenantSlug: tenant.slug,
            dealId: deal.id,
            title: deal.title,
            assignedTo: deal.assignedTo
              ? { id: deal.assignedTo.id, name: deal.assignedTo.name, email: deal.assignedTo.email }
              : null,
            stageName: deal.stage.name,
            daysInStage,
          });
        }
      }
      });

      // Sort by days in stage descending (most stale first)
      allRottingDeals.sort((a, b) => b.daysInStage - a.daysInStage);

      // ── Automated Actions for Rotting Deals ──────────────────────
      // Tag rotting deals, create CRM activities, and notify assignees
      let tagged = 0;
      let activitiesCreated = 0;

      for (const deal of allRottingDeals) {
        try {
          // 1. Add "rotting" tag if not already present
          const currentDeal = await prisma.crmDeal.findUnique({
            where: { id: deal.dealId },
            select: { tags: true },
          });

          if (currentDeal && !currentDeal.tags.includes('rotting')) {
            await prisma.crmDeal.update({
              where: { id: deal.dealId },
              data: { tags: { push: 'rotting' } },
            });
            tagged++;
          }

          // 2. Create a CRM activity to track the rotting detection
          const recentActivity = await prisma.crmActivity.findFirst({
            where: {
              dealId: deal.dealId,
              type: 'NOTE',
              title: { contains: 'Deal rotting' },
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
            select: { id: true },
          });

          if (!recentActivity) {
            await prisma.crmActivity.create({
              data: {
                type: 'NOTE',
                title: `Deal rotting: ${deal.daysInStage} days in "${deal.stageName}"`,
                description: `Auto-detected by cron: Deal "${deal.title}" has been in stage "${deal.stageName}" for ${deal.daysInStage} days without activity. Threshold: ${ROTTING_THRESHOLD_DAYS} days.`,
                dealId: deal.dealId,
                performedById: deal.assignedTo?.id || undefined,
              },
            });
            activitiesCreated++;
          }
        } catch (err) {
          logger.error('[cron/deal-rotting] Error tagging deal', {
            dealId: deal.dealId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return NextResponse.json({
        success: true,
        count: allRottingDeals.length,
        thresholdDays: ROTTING_THRESHOLD_DAYS,
        tagged,
        activitiesCreated,
        deals: allRottingDeals,
        tenants: tenantResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[cron/deal-rotting] Error:', error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
