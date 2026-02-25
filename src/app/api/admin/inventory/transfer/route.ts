import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'OWNER' && session.user.role !== 'EMPLOYEE')) {
      return NextResponse.json({ error: 'Non autoris\u00e9' }, { status: 401 });
    }

    const body = await request.json();
    const { formatId, quantity, fromLocation, toLocation, reason } = body as {
      formatId: string;
      quantity: number;
      fromLocation: string;
      toLocation: string;
      reason?: string;
    };

    if (!formatId || !quantity || quantity <= 0 || !fromLocation || !toLocation) {
      return NextResponse.json({ error: 'Param\u00e8tres manquants' }, { status: 400 });
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
    console.error('Inventory transfer error:', error);
    return NextResponse.json({ error: 'Erreur lors du transfert' }, { status: 500 });
  }
}
