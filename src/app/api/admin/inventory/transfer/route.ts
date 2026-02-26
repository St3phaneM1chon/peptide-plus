// SEC-FIX: Migrated to withAdminGuard for consistent auth + CSRF + rate limiting
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const { formatId, quantity, fromLocation, toLocation, reason } = body as {
      formatId: string;
      quantity: number;
      fromLocation: string;
      toLocation: string;
      reason?: string;
    };

    if (!formatId || !quantity || quantity <= 0 || !fromLocation || !toLocation) {
      return NextResponse.json({ error: 'Parametres manquants' }, { status: 400 });
    }

    if (fromLocation === toLocation) {
      return NextResponse.json({ error: 'Les emplacements source et destination sont identiques' }, { status: 400 });
    }

    // Record inventory transaction
    const transfer = await prisma.inventoryTransaction.create({
      data: {
        productFormatId: formatId,
        type: 'TRANSFER',
        quantity: -quantity, // Out from source
        reason: `Transfer ${fromLocation} \u2192 ${toLocation}${reason ? `: ${reason}` : ''}`,
        userId: session.user.id || 'system',
      },
    });

    // Create corresponding in transaction
    await prisma.inventoryTransaction.create({
      data: {
        productFormatId: formatId,
        type: 'TRANSFER',
        quantity: quantity, // In to destination
        reason: `Transfer ${fromLocation} \u2192 ${toLocation} (in)${reason ? `: ${reason}` : ''}`,
        userId: session.user.id || 'system',
      },
    });

    return NextResponse.json({ success: true, transferId: transfer.id });
  } catch (error) {
    logger.error('Inventory transfer error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
