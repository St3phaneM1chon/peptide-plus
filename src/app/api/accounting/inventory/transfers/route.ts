export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  getTransfers,
  createTransfer,
  type TransferStatus,
} from '@/lib/accounting/inventory.service';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const transferItemSchema = z.object({
  productId: z.string().min(1, 'Product ID required'),
  productName: z.string().min(1, 'Product name required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().min(0, 'Unit cost must be >= 0'),
});

const createTransferSchema = z.object({
  fromWarehouseId: z.string().min(1, 'Source warehouse required'),
  toWarehouseId: z.string().min(1, 'Destination warehouse required'),
  items: z.array(transferItemSchema).min(1, 'At least one item required'),
  notes: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/inventory/transfers
// List transfers with pagination and filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') as TransferStatus) || undefined;
    const warehouseId = searchParams.get('warehouseId') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 100);

    const result = await getTransfers({ status, warehouseId, page, limit });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error fetching transfers', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/inventory/transfers
// Create a new inter-warehouse transfer
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createTransferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await createTransfer({
      ...parsed.data,
      createdBy: session.user?.email || undefined,
    });

    return NextResponse.json({ success: true, transfer: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create transfer';
    logger.error('Error creating transfer', { error: message });

    if (
      message.includes('Insufficient stock') ||
      message.includes('not found') ||
      message.includes('inactive') ||
      message.includes('must be different')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
