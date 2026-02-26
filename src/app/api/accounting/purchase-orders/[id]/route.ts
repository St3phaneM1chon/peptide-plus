export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting/audit-trail.service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateItemSchema = z.object({
  id: z.string().optional(), // existing item id (for update)
  productId: z.string().optional(),
  productName: z.string().min(1),
  description: z.string().optional().default(''),
  sku: z.string().optional(),
  quantity: z.number().min(0.01),
  unitCost: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

const updatePurchaseOrderSchema = z.object({
  supplierName: z.string().min(1).max(200).optional(),
  supplierId: z.string().optional(),
  supplierEmail: z.string().email().optional().or(z.literal('')),
  supplierAddress: z.string().max(500).optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().nullable().optional(),
  currency: z.string().max(3).optional(),
  notes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  department: z.string().max(50).optional(),
  items: z.array(updateItemSchema).optional(),
  // Status transitions handled separately
  status: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Tax calculation helpers
// ---------------------------------------------------------------------------

function calculateTotals(items: { quantity: number; unitCost: number }[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const taxTps = Math.round(subtotal * 0.05 * 100) / 100;
  const taxTvq = Math.round(subtotal * 0.09975 * 100) / 100;
  const total = Math.round((subtotal + taxTps + taxTvq) * 100) / 100;
  return { subtotal, taxTps, taxTvq, total };
}

function serializePO(po: Record<string, unknown> & { items?: Record<string, unknown>[] }) {
  return {
    ...po,
    subtotal: Number(po.subtotal),
    taxTps: Number(po.taxTps),
    taxTvq: Number(po.taxTvq),
    total: Number(po.total),
    items: po.items?.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      quantityReceived: Number(item.quantityReceived),
      unitCost: Number(item.unitCost),
      taxRate: Number(item.taxRate),
      total: Number(item.total),
    })),
  };
}

// ---------------------------------------------------------------------------
// GET /api/accounting/purchase-orders/[id]
// Get a single purchase order with items and receipts
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        receipts: {
          include: { items: true },
          orderBy: { receivedDate: 'desc' },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Bon de commande non trouve' }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        ...po,
        subtotal: Number(po.subtotal),
        taxTps: Number(po.taxTps),
        taxTvq: Number(po.taxTvq),
        total: Number(po.total),
        items: po.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          quantityReceived: Number(item.quantityReceived),
          unitCost: Number(item.unitCost),
          taxRate: Number(item.taxRate),
          total: Number(item.total),
        })),
        receipts: po.receipts.map((r) => ({
          ...r,
          items: r.items.map((ri) => ({
            ...ri,
            quantityReceived: Number(ri.quantityReceived),
          })),
        })),
      },
    });
  } catch (error) {
    logger.error('Get purchase order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation du bon de commande' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/purchase-orders/[id]
// Update a purchase order (content changes only for DRAFT, status for all)
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updatePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Bon de commande non trouve' }, { status: 404 });
    }

    const data = parsed.data;

    // Status transition validation (state machine)
    const VALID_TRANSITIONS: Record<string, string[]> = {
      DRAFT: ['SENT', 'CANCELLED'],
      SENT: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PARTIALLY_RECEIVED', 'RECEIVED'],
      PARTIALLY_RECEIVED: ['RECEIVED'],
      RECEIVED: ['INVOICED'],
      INVOICED: [],
      CANCELLED: [],
    };

    if (data.status && data.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          { error: `Transition invalide: ${existing.status} -> ${data.status}. Transitions autorisees: ${allowed.join(', ') || 'aucune'}` },
          { status: 400 }
        );
      }
    }

    // Content changes only for DRAFT
    const isContentChange = data.supplierName || data.supplierEmail !== undefined || data.supplierAddress !== undefined ||
      data.orderDate || data.expectedDate !== undefined || data.notes !== undefined || data.internalNotes !== undefined ||
      data.department || data.items;

    if (isContentChange && existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seuls les bons de commande en brouillon peuvent etre modifies. Utilisez les actions specifiques pour les changements de statut.' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};

      // Content fields (DRAFT only)
      if (existing.status === 'DRAFT') {
        if (data.supplierName) updateData.supplierName = data.supplierName;
        if (data.supplierId !== undefined) updateData.supplierId = data.supplierId || null;
        if (data.supplierEmail !== undefined) updateData.supplierEmail = data.supplierEmail || null;
        if (data.supplierAddress !== undefined) updateData.supplierAddress = data.supplierAddress || null;
        if (data.orderDate) updateData.orderDate = new Date(data.orderDate);
        if (data.expectedDate !== undefined) updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : null;
        if (data.currency) updateData.currency = data.currency;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
        if (data.department) updateData.department = data.department;

        // Update items: delete all existing + recreate
        if (data.items && data.items.length > 0) {
          await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

          await tx.purchaseOrderItem.createMany({
            data: data.items.map((item) => ({
              purchaseOrderId: id,
              productId: item.productId || null,
              productName: item.productName,
              description: item.description || '',
              sku: item.sku || null,
              quantity: item.quantity,
              unitCost: item.unitCost,
              taxRate: item.taxRate,
              total: Math.round(item.quantity * item.unitCost * 100) / 100,
              notes: item.notes || null,
            })),
          });

          // Recalculate totals
          const totals = calculateTotals(data.items);
          updateData.subtotal = totals.subtotal;
          updateData.taxTps = totals.taxTps;
          updateData.taxTvq = totals.taxTvq;
          updateData.total = totals.total;
        }
      }

      // Status transition
      if (data.status && data.status !== existing.status) {
        updateData.status = data.status;
        if (data.status === 'CANCELLED') {
          updateData.cancelledAt = new Date();
          updateData.cancelledBy = session?.user?.email || session?.user?.name || null;
          updateData.cancelReason = body.cancelReason || null;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return existing;
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: updateData,
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
    });

    // Audit trail
    logAuditTrail({
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'UPDATE',
      field: data.status ? 'status' : undefined,
      oldValue: data.status ? existing.status : null,
      newValue: data.status || null,
      userId: session?.user?.id || session?.user?.email || 'system',
      userName: session?.user?.name || undefined,
      metadata: { poNumber: existing.poNumber },
    }).catch(() => { /* non-blocking */ });

    return NextResponse.json({
      success: true,
      order: serializePO(result as unknown as Record<string, unknown> & { items?: Record<string, unknown>[] }),
    });
  } catch (error) {
    logger.error('Update purchase order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour du bon de commande' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/purchase-orders/[id]
// Soft delete (DRAFT only)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Bon de commande non trouve' }, { status: 404 });
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seuls les bons de commande en brouillon peuvent etre supprimes' },
        { status: 400 }
      );
    }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit trail
    logAuditTrail({
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'DELETE',
      userId: session?.user?.id || session?.user?.email || 'system',
      userName: session?.user?.name || undefined,
      metadata: { poNumber: existing.poNumber, supplierName: existing.supplierName },
    }).catch(() => { /* non-blocking */ });

    logger.info('Purchase order soft-deleted', { poNumber: existing.poNumber });

    return NextResponse.json({ success: true, message: 'Bon de commande supprime' });
  } catch (error) {
    logger.error('Delete purchase order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du bon de commande' },
      { status: 500 }
    );
  }
});
