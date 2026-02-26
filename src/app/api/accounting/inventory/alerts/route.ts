export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { getReorderAlerts } from '@/lib/accounting/inventory.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/inventory/alerts
// Get reorder alerts (products below reorder point)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async () => {
  try {
    const alerts = await getReorderAlerts();

    return NextResponse.json({
      alerts,
      count: alerts.length,
      totalDeficit: alerts.reduce((sum, a) => sum + a.deficit, 0),
      estimatedReorderCost: alerts.reduce((sum, a) => {
        const qty = a.reorderQty ?? a.deficit;
        return sum + qty * a.unitCost;
      }, 0),
    });
  } catch (error) {
    logger.error('Error fetching reorder alerts', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch reorder alerts' }, { status: 500 });
  }
});
