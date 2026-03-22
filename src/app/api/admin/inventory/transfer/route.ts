export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

const transferSchema = z.object({
  productId: z.string().min(1, 'Product ID required'),
  optionId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  fromLocation: z.string().min(1, 'Source location required'),
  toLocation: z.string().min(1, 'Destination location required'),
  reason: z.string().max(500).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      );
    }

    const { productId, optionId, quantity, fromLocation, toLocation, reason } = parsed.data;

    if (fromLocation === toLocation) {
      return NextResponse.json(
        { error: 'Source and destination locations must be different' },
        { status: 400 }
      );
    }

    // Use a transaction to ensure both out/in records are created atomically
    // and WAC is preserved from existing inventory data
    const result = await prisma.$transaction(async (tx) => {
      // Look up existing WAC for this product/format to preserve cost data
      const latestTx = await tx.inventoryTransaction.findFirst({
        where: {
          productId,
          ...(optionId ? { optionId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: { runningWAC: true, unitCost: true },
      });

      const currentWAC = latestTx ? Number(latestTx.runningWAC) : 0;
      const currentUnitCost = latestTx ? Number(latestTx.unitCost) : 0;

      const transferReason = `Transfer ${fromLocation} → ${toLocation}${reason ? `: ${reason}` : ''}`;

      // Record out-transaction (source location)
      const outTx = await tx.inventoryTransaction.create({
        data: {
          productId,
          optionId: optionId ?? null,
          type: 'ADJUSTMENT',
          quantity: -quantity,
          unitCost: currentUnitCost,
          runningWAC: currentWAC,
          reason: transferReason,
          createdBy: session.user.id || 'system',
        },
      });

      // Record in-transaction (destination location)
      await tx.inventoryTransaction.create({
        data: {
          productId,
          optionId: optionId ?? null,
          type: 'ADJUSTMENT',
          quantity: quantity,
          unitCost: currentUnitCost,
          runningWAC: currentWAC,
          reason: `${transferReason} (in)`,
          createdBy: session.user.id || 'system',
        },
      });

      return outTx;
    });

    return NextResponse.json({ success: true, transferId: result.id });
  } catch (error) {
    logger.error('Inventory transfer error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
