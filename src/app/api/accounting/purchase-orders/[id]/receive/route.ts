export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting/audit-trail.service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schema for receipt
// ---------------------------------------------------------------------------

const receiveItemSchema = z.object({
  purchaseOrderItemId: z.string().min(1, 'ID de la ligne requis'),
  quantityReceived: z.number().min(0.01, 'Quantite recue doit etre > 0'),
  notes: z.string().optional(),
});

const receiveSchema = z.object({
  receivedDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(receiveItemSchema).min(1, 'Au moins un article doit etre recu'),
});

/**
 * POST /api/accounting/purchase-orders/[id]/receive
 * Record receipt of goods (partial or full).
 * Creates PurchaseOrderReceipt + items.
 * Updates quantityReceived on PO items.
 * Auto-transitions to PARTIALLY_RECEIVED or RECEIVED.
 */
export const POST = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = receiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });

    if (!po) {
      return NextResponse.json({ error: 'Bon de commande non trouve' }, { status: 404 });
    }

    // Can receive from CONFIRMED, SENT, or PARTIALLY_RECEIVED
    if (!['CONFIRMED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      return NextResponse.json(
        { error: `Impossible de recevoir des marchandises pour un bon de commande avec le statut "${po.status}". Statuts acceptes: CONFIRMED, SENT, PARTIALLY_RECEIVED.` },
        { status: 400 }
      );
    }

    // Validate each receipt item against PO items
    const poItemMap = new Map(po.items.map((item) => [item.id, item]));
    for (const receiveItem of data.items) {
      const poItem = poItemMap.get(receiveItem.purchaseOrderItemId);
      if (!poItem) {
        return NextResponse.json(
          { error: `Ligne de commande "${receiveItem.purchaseOrderItemId}" non trouvee dans ce bon de commande` },
          { status: 400 }
        );
      }
      const alreadyReceived = Number(poItem.quantityReceived);
      const ordered = Number(poItem.quantity);
      if (alreadyReceived + receiveItem.quantityReceived > ordered * 1.1) {
        // Allow up to 10% over-delivery
        return NextResponse.json(
          { error: `Quantite recue trop importante pour "${poItem.productName || poItem.description}". Commande: ${ordered}, deja recu: ${alreadyReceived}, tentative: ${receiveItem.quantityReceived}` },
          { status: 400 }
        );
      }
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the receipt
      const receipt = await tx.purchaseOrderReceipt.create({
        data: {
          purchaseOrderId: id,
          receivedDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
          receivedBy: session?.user?.email || session?.user?.name || null,
          notes: data.notes || null,
          items: {
            create: data.items.map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId,
              quantityReceived: item.quantityReceived,
              notes: item.notes || null,
            })),
          },
        },
        include: { items: true },
      });

      // Update quantityReceived on PO items
      for (const receiveItem of data.items) {
        const poItem = poItemMap.get(receiveItem.purchaseOrderItemId)!;
        const newReceived = Number(poItem.quantityReceived) + receiveItem.quantityReceived;
        await tx.purchaseOrderItem.update({
          where: { id: receiveItem.purchaseOrderItemId },
          data: {
            quantityReceived: newReceived,
            receivedQty: Math.floor(newReceived),
          },
        });
      }

      // Determine new status: check all items
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const allFullyReceived = updatedItems.every(
        (item) => Number(item.quantityReceived) >= Number(item.quantity)
      );
      const someReceived = updatedItems.some(
        (item) => Number(item.quantityReceived) > 0
      );

      let newStatus: string;
      if (allFullyReceived) {
        newStatus = 'RECEIVED';
      } else if (someReceived) {
        newStatus = 'PARTIALLY_RECEIVED';
      } else {
        newStatus = po.status;
      }

      // Update PO status and receivedDate if fully received
      const poUpdate: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'RECEIVED') {
        poUpdate.receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
        poUpdate.receivedAt = data.receivedDate ? new Date(data.receivedDate) : new Date();
      }

      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: poUpdate,
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          receipts: {
            include: { items: true },
            orderBy: { receivedDate: 'desc' },
          },
        },
      });

      return { receipt, order: updatedPO, newStatus };
    });

    // Audit trail
    logAuditTrail({
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: po.status,
      newValue: result.newStatus,
      userId: session?.user?.id || session?.user?.email || 'system',
      userName: session?.user?.name || undefined,
      metadata: {
        poNumber: po.poNumber,
        receiptId: result.receipt.id,
        itemsReceived: data.items.length,
        newStatus: result.newStatus,
      },
    }).catch(() => { /* non-blocking */ });

    logger.info('Purchase order goods received', {
      poNumber: po.poNumber,
      receiptId: result.receipt.id,
      newStatus: result.newStatus,
      itemsReceived: data.items.length,
    });

    return NextResponse.json({
      success: true,
      receipt: {
        ...result.receipt,
        items: result.receipt.items.map((ri) => ({
          ...ri,
          quantityReceived: Number(ri.quantityReceived),
        })),
      },
      order: {
        ...result.order,
        subtotal: Number(result.order.subtotal),
        taxTps: Number(result.order.taxTps),
        taxTvq: Number(result.order.taxTvq),
        total: Number(result.order.total),
        items: result.order.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          quantityReceived: Number(item.quantityReceived),
          unitCost: Number(item.unitCost),
          taxRate: Number(item.taxRate),
          total: Number(item.total),
        })),
        receipts: result.order.receipts.map((r) => ({
          ...r,
          items: r.items.map((ri) => ({
            ...ri,
            quantityReceived: Number(ri.quantityReceived),
          })),
        })),
      },
      message: result.newStatus === 'RECEIVED'
        ? 'Toutes les marchandises ont ete recues'
        : 'Reception partielle enregistree',
    });
  } catch (error) {
    logger.error('Receive purchase order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la reception des marchandises' },
      { status: 500 }
    );
  }
});
