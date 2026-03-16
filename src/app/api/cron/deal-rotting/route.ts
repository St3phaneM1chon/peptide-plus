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
      const now = new Date();
      const thresholdDate = new Date(now.getTime() - ROTTING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

      // Find deals in non-terminal stages (not won, not lost)
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
      const rottingDeals: Array<{
        dealId: string;
        title: string;
        assignedTo: { id: string; name: string | null; email: string | null } | null;
        stageName: string;
        daysInStage: number;
      }> = [];

      for (const deal of deals) {
        const lastStageChange = deal.stageHistory[0]?.createdAt;
        if (!lastStageChange) continue;

        if (lastStageChange < thresholdDate) {
          const daysInStage = Math.floor(
            (now.getTime() - lastStageChange.getTime()) / (24 * 60 * 60 * 1000)
          );

          rottingDeals.push({
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

      // Sort by days in stage descending (most stale first)
      rottingDeals.sort((a, b) => b.daysInStage - a.daysInStage);

      return NextResponse.json({
        success: true,
        count: rottingDeals.length,
        thresholdDays: ROTTING_THRESHOLD_DAYS,
        deals: rottingDeals,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[cron/deal-rotting] Error:', error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
