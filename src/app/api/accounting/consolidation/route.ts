export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  getConsolidatedReport,
  getEntityComparison,
} from '@/lib/accounting/multi-entity.service';

/**
 * GET /api/accounting/consolidation
 * Get consolidated financial report across entities.
 * Query params:
 *   - startDate (required): ISO date string
 *   - endDate (required): ISO date string
 *   - entityIds (optional): comma-separated entity IDs
 *   - view (optional): "comparison" for side-by-side comparison
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const entityIdsStr = searchParams.get('entityIds');
    const view = searchParams.get('view');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'Les parametres startDate et endDate sont requis' },
        { status: 400 },
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Dates invalides' },
        { status: 400 },
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'La date de debut doit etre anterieure a la date de fin' },
        { status: 400 },
      );
    }

    const entityIds = entityIdsStr
      ? entityIdsStr.split(',').filter(Boolean)
      : undefined;

    // Entity comparison view
    if (view === 'comparison') {
      if (!entityIds || entityIds.length < 2) {
        return NextResponse.json(
          { error: 'Au moins 2 entites sont requises pour une comparaison' },
          { status: 400 },
        );
      }

      const comparison = await getEntityComparison(entityIds, startDate, endDate);
      return NextResponse.json({ data: comparison });
    }

    // Default: consolidated report
    const report = await getConsolidatedReport(startDate, endDate, entityIds);
    return NextResponse.json({ data: report });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('No valid entities')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    logger.error('Get consolidated report error', { error: msg });
    return NextResponse.json(
      { error: 'Erreur lors de la generation du rapport consolide' },
      { status: 500 },
    );
  }
});
