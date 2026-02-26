export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  getTransferById,
  completeTransfer,
  cancelTransfer,
} from '@/lib/accounting/inventory.service';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateTransferSchema = z.object({
  action: z.enum(['complete', 'cancel']),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/inventory/transfers/[id]
// Get a single transfer
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const { id } = params;

    const transfer = await getTransferById(id);
    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    return NextResponse.json({ transfer });
  } catch (error) {
    logger.error('Error fetching transfer', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch transfer' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/inventory/transfers/[id]
// Complete or cancel a transfer
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request, { params, session }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const parsed = updateTransferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data. Expected: { action: "complete" | "cancel" }' },
        { status: 400 }
      );
    }

    const { action } = parsed.data;
    const userEmail = session.user?.email || undefined;

    let result;
    if (action === 'complete') {
      result = await completeTransfer(id, userEmail);
    } else {
      result = await cancelTransfer(id, userEmail);
    }

    return NextResponse.json({ success: true, transfer: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update transfer';
    logger.error('Error updating transfer', { error: message });

    if (
      message.includes('not found') ||
      message.includes('already') ||
      message.includes('must be') ||
      message.includes('Cannot cancel')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
