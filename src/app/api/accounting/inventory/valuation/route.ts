export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  getInventoryValuationReport,
  getStockValue,
  type CostMethod,
} from '@/lib/accounting/inventory.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/inventory/valuation
// Get inventory valuation report
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId') || undefined;
    const costMethod = (searchParams.get('costMethod') as CostMethod) || 'WAC';
    const summary = searchParams.get('summary') === 'true';

    // Validate cost method
    if (!['FIFO', 'LIFO', 'WAC'].includes(costMethod)) {
      return NextResponse.json(
        { error: 'Invalid cost method. Must be FIFO, LIFO, or WAC' },
        { status: 400 }
      );
    }

    if (summary) {
      // Quick summary without per-product calculation
      const value = await getStockValue(warehouseId, costMethod);
      return NextResponse.json({ summary: value });
    }

    const report = await getInventoryValuationReport(warehouseId, costMethod);

    return NextResponse.json({ report });
  } catch (error) {
    logger.error('Error generating valuation report', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to generate valuation report' }, { status: 500 });
  }
});
