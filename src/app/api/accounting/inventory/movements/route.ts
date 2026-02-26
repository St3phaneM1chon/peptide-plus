export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  getMovementHistory,
  type MovementType,
} from '@/lib/accounting/inventory.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/inventory/movements
// Get stock movement history with filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId') || undefined;
    const warehouseId = searchParams.get('warehouseId') || undefined;
    const type = (searchParams.get('type') as MovementType) || undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '50') || 50),
      200
    );

    const result = await getMovementHistory({
      productId,
      warehouseId,
      type,
      startDate,
      endDate,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error fetching movement history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch movement history' },
      { status: 500 }
    );
  }
});
