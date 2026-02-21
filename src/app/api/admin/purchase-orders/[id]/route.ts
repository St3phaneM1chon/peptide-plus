export const dynamic = 'force-dynamic';

/**
 * Admin Purchase Order Detail API
 * GET    - Get full PO detail with items and related data
 * PATCH  - Update PO status, items, supplier info, notes
 * DELETE - Delete a PO (only DRAFT or CANCELLED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// Valid PO statuses and allowed transitions
const VALID_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'ORDERED',
  'PARTIAL_RECEIVED',
  'RECEIVED',
  'CANCELLED',
] as const;

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIAL_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],       // Terminal state
  CANCELLED: [],      // Terminal state
};

// Helper to serialize Decimal fields
function serializePO(po: Record<string, unknown>) {
  return {
    ...po,
    subtotal: Number(po.subtotal),
    taxTps: Number(po.taxTps),
    taxTvq: Number(po.taxTvq),
    total: Number(po.total),
    items: Array.isArray(po.items)
      ? (po.items as Record<string, unknown>[]).map((item) => ({
          ...item,
          unitCost: Number(item.unitCost),
          total: Number(item.total),
        }))
      : [],
  };
}

// ─── GET /api/admin/purchase-orders/[id] ────────────────────────────────────────
export const GET = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Fetch related inventory transactions (if PO was received)
    const inventoryTransactions = po.status === 'RECEIVED' || po.status === 'PARTIAL_RECEIVED'
      ? await prisma.inventoryTransaction.findMany({
          where: {
            type: 'PURCHASE',
            supplierInvoiceId: po.supplierInvoiceId || undefined,
            productId: {
              in: po.items
                .filter((item) => item.productId)
                .map((item) => item.productId!),
            },
            createdAt: {
              gte: po.receivedAt || po.createdAt,
            },
          },
          select: {
            id: true,
            productId: true,
            formatId: true,
            type: true,
            quantity: true,
            unitCost: true,
            runningWAC: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // Fetch linked journal entries
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        reference: { contains: po.poNumber },
      },
      select: {
        id: true,
        entryNumber: true,
        type: true,
        description: true,
        status: true,
        date: true,
        lines: {
          select: {
            id: true,
            accountId: true,
            description: true,
            debit: true,
            credit: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch linked supplier invoice
    let supplierInvoice = null;
    if (po.supplierInvoiceId) {
      supplierInvoice = await prisma.supplierInvoice.findUnique({
        where: { id: po.supplierInvoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          subtotal: true,
          total: true,
          invoiceDate: true,
          dueDate: true,
          paidAt: true,
        },
      });
      if (supplierInvoice) {
        supplierInvoice = {
          ...supplierInvoice,
          subtotal: Number(supplierInvoice.subtotal),
          total: Number(supplierInvoice.total),
        } as typeof supplierInvoice;
      }
    }

    // Fetch requestedBy / approvedBy user names
    const userIds = [po.requestedBy, po.approvedBy].filter(Boolean) as string[];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      ...serializePO(po as unknown as Record<string, unknown>),
      requestedByUser: po.requestedBy ? userMap.get(po.requestedBy) || null : null,
      approvedByUser: po.approvedBy ? userMap.get(po.approvedBy) || null : null,
      inventoryTransactions: inventoryTransactions.map((tx) => ({
        ...tx,
        unitCost: Number(tx.unitCost),
        runningWAC: Number(tx.runningWAC),
      })),
      journalEntries: journalEntries.map((je) => ({
        ...je,
        lines: je.lines.map((line) => ({
          ...line,
          debit: Number(line.debit),
          credit: Number(line.credit),
        })),
      })),
      supplierInvoice,
    });
  } catch (error) {
    console.error('Admin purchase order GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// ─── PATCH /api/admin/purchase-orders/[id] ──────────────────────────────────────
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // ─── Status transition ──────────────────────────────────────────────
    if (body.status) {
      const newStatus = body.status as string;

      // Validate status value
      if (!VALID_STATUSES.includes(newStatus as typeof VALID_STATUSES[number])) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate transition
      const allowed = STATUS_TRANSITIONS[po.status] || [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${po.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
          },
          { status: 400 }
        );
      }

      updateData.status = newStatus;

      // Set timestamps and related data based on new status
      if (newStatus === 'APPROVED') {
        updateData.approvedBy = session!.user.id;
        updateData.approvedAt = new Date();
      }

      if (newStatus === 'ORDERED') {
        updateData.orderedAt = new Date();
      }

      if (newStatus === 'CANCELLED') {
        // Only allow cancellation if nothing has been received
        const hasReceivedItems = po.items.some((item) => item.receivedQty > 0);
        if (hasReceivedItems) {
          return NextResponse.json(
            { error: 'Cannot cancel a PO with received items. Use partial receive workflow instead.' },
            { status: 400 }
          );
        }
      }
    }

    // ─── Update editable fields (only on DRAFT / SUBMITTED) ─────────────
    const isEditable = po.status === 'DRAFT' || po.status === 'SUBMITTED';

    if (body.supplierName !== undefined && isEditable) {
      updateData.supplierName = body.supplierName;
    }
    if (body.supplierEmail !== undefined && isEditable) {
      updateData.supplierEmail = body.supplierEmail;
    }
    if (body.supplierId !== undefined && isEditable) {
      updateData.supplierId = body.supplierId;
    }
    if (body.department !== undefined && isEditable) {
      updateData.department = body.department;
    }
    if (body.currency !== undefined && isEditable) {
      updateData.currency = body.currency;
    }

    // Notes can always be updated
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    // Link supplier invoice
    if (body.supplierInvoiceId !== undefined) {
      updateData.supplierInvoiceId = body.supplierInvoiceId;
    }

    // ─── Update items (only on DRAFT / SUBMITTED) ───────────────────────
    if (body.items && isEditable) {
      const newItems = body.items as Array<{
        id?: string;
        description: string;
        productId?: string;
        formatId?: string;
        sku?: string;
        quantity: number;
        unitCost: number;
      }>;

      // Delete existing items and recreate
      await prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id },
      });

      let subtotal = 0;
      const processedItems = newItems.map((item) => {
        const qty = Number(item.quantity);
        const cost = Number(item.unitCost);
        const lineTotal = Math.round(qty * cost * 100) / 100;
        subtotal += lineTotal;
        return {
          purchaseOrderId: id,
          description: item.description,
          productId: item.productId || null,
          formatId: item.formatId || null,
          sku: item.sku || null,
          quantity: qty,
          unitCost: cost,
          total: lineTotal,
        };
      });

      await prisma.purchaseOrderItem.createMany({
        data: processedItems,
      });

      // Recalculate totals
      subtotal = Math.round(subtotal * 100) / 100;
      const taxTps = Math.round(subtotal * 0.05 * 100) / 100;
      const taxTvq = Math.round(subtotal * 0.09975 * 100) / 100;
      const total = Math.round((subtotal + taxTps + taxTvq) * 100) / 100;

      updateData.subtotal = subtotal;
      updateData.taxTps = taxTps;
      updateData.taxTvq = taxTvq;
      updateData.total = total;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    logAdminAction({
      adminUserId: session!.user.id,
      action: 'UPDATE_PURCHASE_ORDER',
      targetType: 'PurchaseOrder',
      targetId: id,
      previousValue: { status: po.status, supplierName: po.supplierName },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(
      serializePO(updated as unknown as Record<string, unknown>)
    );
  } catch (error) {
    console.error('Admin purchase order PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// ─── DELETE /api/admin/purchase-orders/[id] ─────────────────────────────────────
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, poNumber: true },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of DRAFT or CANCELLED orders
    if (po.status !== 'DRAFT' && po.status !== 'CANCELLED') {
      return NextResponse.json(
        {
          error: `Cannot delete a purchase order with status ${po.status}. Only DRAFT or CANCELLED orders can be deleted.`,
        },
        { status: 400 }
      );
    }

    // Cascade delete will remove PurchaseOrderItems
    await prisma.purchaseOrder.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session!.user.id,
      action: 'DELETE_PURCHASE_ORDER',
      targetType: 'PurchaseOrder',
      targetId: id,
      previousValue: { poNumber: po.poNumber, status: po.status },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Purchase order ${po.poNumber} deleted`,
    });
  } catch (error) {
    console.error('Admin purchase order DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
