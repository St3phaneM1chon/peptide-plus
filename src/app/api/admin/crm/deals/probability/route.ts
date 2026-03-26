export const dynamic = 'force-dynamic';

/**
 * #32 Predictive Deal Closure API
 * GET /api/admin/crm/deals/probability?dealId=xxx
 * GET /api/admin/crm/deals/probability — Pipeline-wide probabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { calculateDealProbability, getPipelineProbabilities } from '@/lib/crm/deal-probability';
import { logger } from '@/lib/logger';

async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId');

    if (dealId) {
      const result = await calculateDealProbability(dealId);
      if (!result) {
        return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
      }
      return NextResponse.json({ data: result });
    }

    // Pipeline-wide probabilities
    const pipeline = await getPipelineProbabilities();
    return NextResponse.json({ data: { deals: pipeline } });
  } catch (error) {
    logger.error('[deal-probability] API error:', error);
    return NextResponse.json({ error: 'Failed to calculate probability' }, { status: 500 });
  }
}

export const GET = withAdminGuard(handler);
