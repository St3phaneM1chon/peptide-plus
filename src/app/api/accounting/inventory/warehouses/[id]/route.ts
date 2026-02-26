export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
} from '@/lib/accounting/inventory.service';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/).optional(),
  address: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/inventory/warehouses/[id]
// Get a single warehouse
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const { id } = params;

    const warehouse = await getWarehouseById(id);
    if (!warehouse || warehouse.deletedAt) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    return NextResponse.json({ warehouse });
  } catch (error) {
    logger.error('Error fetching warehouse', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch warehouse' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/inventory/warehouses/[id]
// Update a warehouse
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request, { params }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const parsed = updateWarehouseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await getWarehouseById(id);
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    const warehouse = await updateWarehouse(id, parsed.data);

    return NextResponse.json({ success: true, warehouse });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update warehouse';
    logger.error('Error updating warehouse', { error: message });

    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A warehouse with this code already exists' }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/inventory/warehouses/[id]
// Soft-delete a warehouse
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (_request, { params }) => {
  try {
    const { id } = params;

    await deleteWarehouse(id);

    return NextResponse.json({ success: true, message: 'Warehouse deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete warehouse';
    logger.error('Error deleting warehouse', { error: message });

    if (
      message.includes('Cannot delete') ||
      message.includes('not found')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
