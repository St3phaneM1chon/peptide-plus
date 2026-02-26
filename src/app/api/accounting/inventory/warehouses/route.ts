export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { getWarehouses, createWarehouse } from '@/lib/accounting/inventory.service';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  code: z.string().min(1, 'Code required').max(20).regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric'),
  address: z.string().max(500).optional(),
  isDefault: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/inventory/warehouses
// List all warehouses
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const warehouses = await getWarehouses(includeInactive);

    return NextResponse.json({ warehouses });
  } catch (error) {
    logger.error('Error fetching warehouses', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/inventory/warehouses
// Create a new warehouse
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createWarehouseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const warehouse = await createWarehouse(parsed.data);

    return NextResponse.json({ success: true, warehouse }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create warehouse';
    logger.error('Error creating warehouse', { error: message });

    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A warehouse with this code already exists' }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
