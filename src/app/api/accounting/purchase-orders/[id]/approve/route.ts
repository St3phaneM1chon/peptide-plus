export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting/audit-trail.service';
import { logger } from '@/lib/logger';

/**
 * POST /api/accounting/purchase-orders/[id]/approve
 * Approve a purchase order (set approvedBy, approvedAt)
 * Can be approved from DRAFT or SENT status
 */
export const POST = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
    });

    if (!po) {
      return NextResponse.json({ error: 'Bon de commande non trouve' }, { status: 404 });
    }

    // PO can be approved from DRAFT or SENT
    if (!['DRAFT', 'SENT'].includes(po.status)) {
      return NextResponse.json(
        { error: `Impossible d'approuver un bon de commande avec le statut "${po.status}". Seuls les brouillons et envoyes peuvent etre approuves.` },
        { status: 400 }
      );
    }

    const approvedBy = session?.user?.email || session?.user?.name || 'unknown';
    const now = new Date();

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        approvedBy,
        approvedAt: now,
        // If DRAFT, mark as CONFIRMED; if SENT, also mark as CONFIRMED
        status: 'CONFIRMED',
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });

    // Audit trail
    logAuditTrail({
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'APPROVE',
      field: 'status',
      oldValue: po.status,
      newValue: 'CONFIRMED',
      userId: session?.user?.id || session?.user?.email || 'system',
      userName: session?.user?.name || undefined,
      metadata: {
        poNumber: po.poNumber,
        approvedBy,
        approvedAt: now.toISOString(),
      },
    }).catch(() => { /* non-blocking */ });

    logger.info('Purchase order approved', {
      poNumber: po.poNumber,
      approvedBy,
    });

    return NextResponse.json({
      success: true,
      order: {
        ...updated,
        subtotal: Number(updated.subtotal),
        taxTps: Number(updated.taxTps),
        taxTvq: Number(updated.taxTvq),
        total: Number(updated.total),
        items: updated.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          quantityReceived: Number(item.quantityReceived),
          unitCost: Number(item.unitCost),
          taxRate: Number(item.taxRate),
          total: Number(item.total),
        })),
      },
      message: 'Bon de commande approuve',
    });
  } catch (error) {
    logger.error('Approve purchase order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Erreur lors de l'approbation du bon de commande" },
      { status: 500 }
    );
  }
});
