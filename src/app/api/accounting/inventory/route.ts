export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  getStockLevels,
  recordMovement,
  adjustStock,
  type MovementType,
  type ReferenceType,
} from '@/lib/accounting/inventory.service';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const recordMovementSchema = z.object({
  productId: z.string().min(1, 'Product ID required'),
  warehouseId: z.string().min(1, 'Warehouse ID required'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'PRODUCTION', 'CONSUMPTION']),
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().min(0, 'Unit cost must be >= 0'),
  reference: z.string().optional(),
  referenceType: z.enum(['ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'MANUAL', 'PRODUCTION']).optional(),
  notes: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/inventory
// Stock levels with optional filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId') || undefined;
    const productId = searchParams.get('productId') || undefined;
    const belowReorder = searchParams.get('belowReorder') === 'true';
    const search = searchParams.get('search') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);

    const result = await getStockLevels({
      warehouseId,
      productId,
      belowReorder,
      search,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error fetching stock levels', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch stock levels' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/inventory
// Record a stock movement
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = recordMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const result = await recordMovement({
      productId: data.productId,
      warehouseId: data.warehouseId,
      type: data.type as MovementType,
      quantity: data.quantity,
      unitCost: data.unitCost,
      reference: data.reference,
      referenceType: data.referenceType as ReferenceType | undefined,
      notes: data.notes,
      createdBy: session.user?.email || undefined,
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record movement';
    logger.error('Error recording stock movement', { error: message });

    if (message.includes('Insufficient stock') || message.includes('no stock level')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/inventory
// Adjust stock (physical count)
// ---------------------------------------------------------------------------

const adjustStockSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  newQuantity: z.number().min(0, 'Quantity cannot be negative'),
  reason: z.string().min(1, 'Adjustment reason is required').max(2000),
});

export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = adjustStockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await adjustStock({
      ...parsed.data,
      createdBy: session.user?.email || undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to adjust stock';
    logger.error('Error adjusting stock', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
