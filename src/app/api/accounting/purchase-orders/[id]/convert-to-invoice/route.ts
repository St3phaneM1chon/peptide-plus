export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting/audit-trail.service';
import { logger } from '@/lib/logger';

/**
 * POST /api/accounting/purchase-orders/[id]/convert-to-invoice
 * Convert a received PO to a SupplierInvoice.
 * Creates SupplierInvoice with same items/amounts.
 * Links via supplierInvoiceId.
 * Transitions PO to INVOICED.
 */
export const POST = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    // Optional: accept invoiceNumber and invoiceDate from body
    let invoiceNumber: string | undefined;
    let invoiceDate: Date | undefined;
    let dueDate: Date | undefined;
    try {
      const body = await request.json();
      if (body.invoiceNumber) invoiceNumber = body.invoiceNumber;
      if (body.invoiceDate) invoiceDate = new Date(body.invoiceDate);
      if (body.dueDate) dueDate = new Date(body.dueDate);
    } catch {
      // Body is optional for this route
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });

    if (!po) {
      return NextResponse.json({ error: 'Bon de commande non trouve' }, { status: 404 });
    }

    // Only RECEIVED POs can be converted
    if (po.status !== 'RECEIVED') {
      return NextResponse.json(
        { error: `Impossible de convertir un bon de commande avec le statut "${po.status}". Seuls les bons "RECEIVED" (marchandises recues) peuvent etre convertis en facture.` },
        { status: 400 }
      );
    }

    // Check if already converted
    if (po.supplierInvoiceId) {
      return NextResponse.json(
        { error: 'Ce bon de commande a deja ete converti en facture fournisseur' },
        { status: 409 }
      );
    }

    // Generate supplier invoice number
    const year = new Date().getFullYear();
    const siPrefix = `FF-${year}-`;
    const [maxRow] = await prisma.$queryRaw<{ max_num: string | null }[]>`
      SELECT MAX("invoiceNumber") as max_num
      FROM "SupplierInvoice"
      WHERE "invoiceNumber" LIKE ${siPrefix + '%'}
    `;
    let nextNum = 1;
    if (maxRow?.max_num) {
      const num = parseInt(maxRow.max_num.split('-').pop() || '0');
      if (!isNaN(num)) nextNum = num + 1;
    }
    const generatedInvoiceNumber = invoiceNumber || `${siPrefix}${String(nextNum).padStart(5, '0')}`;

    const now = new Date();
    const invDate = invoiceDate || now;
    const invDueDate = dueDate || new Date(invDate.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days default

    // Create supplier invoice in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the SupplierInvoice
      const supplierInvoice = await tx.supplierInvoice.create({
        data: {
          invoiceNumber: generatedInvoiceNumber,
          supplierId: po.supplierId || null,
          supplierName: po.supplierName,
          supplierEmail: po.supplierEmail || null,
          subtotal: Number(po.subtotal),
          taxTps: Number(po.taxTps),
          taxTvq: Number(po.taxTvq),
          taxOther: 0,
          total: Number(po.total),
          balance: Number(po.total),
          invoiceDate: invDate,
          dueDate: invDueDate,
          status: 'DRAFT',
          notes: `Genere automatiquement a partir du bon de commande ${po.poNumber}`,
          currency: po.currency,
        },
      });

      // Update PO: link to invoice + set INVOICED status
      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'INVOICED',
          supplierInvoiceId: supplierInvoice.id,
        },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });

      return { supplierInvoice, order: updatedPO };
    });

    // Audit trail for PO
    logAuditTrail({
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: 'RECEIVED',
      newValue: 'INVOICED',
      userId: session?.user?.id || session?.user?.email || 'system',
      userName: session?.user?.name || undefined,
      metadata: {
        poNumber: po.poNumber,
        supplierInvoiceId: result.supplierInvoice.id,
        supplierInvoiceNumber: generatedInvoiceNumber,
      },
    }).catch(() => { /* non-blocking */ });

    // Audit trail for supplier invoice
    logAuditTrail({
      entityType: 'SUPPLIER_INVOICE',
      entityId: result.supplierInvoice.id,
      action: 'CREATE',
      userId: session?.user?.id || session?.user?.email || 'system',
      userName: session?.user?.name || undefined,
      metadata: {
        invoiceNumber: generatedInvoiceNumber,
        source: 'purchase-order-conversion',
        poNumber: po.poNumber,
        purchaseOrderId: id,
      },
    }).catch(() => { /* non-blocking */ });

    logger.info('Purchase order converted to supplier invoice', {
      poNumber: po.poNumber,
      supplierInvoiceNumber: generatedInvoiceNumber,
      total: Number(po.total),
    });

    return NextResponse.json({
      success: true,
      supplierInvoice: {
        ...result.supplierInvoice,
        subtotal: Number(result.supplierInvoice.subtotal),
        taxTps: Number(result.supplierInvoice.taxTps),
        taxTvq: Number(result.supplierInvoice.taxTvq),
        taxOther: Number(result.supplierInvoice.taxOther),
        total: Number(result.supplierInvoice.total),
        balance: Number(result.supplierInvoice.balance),
        amountPaid: Number(result.supplierInvoice.amountPaid),
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
      },
      message: `Facture fournisseur ${generatedInvoiceNumber} creee a partir du bon de commande ${po.poNumber}`,
    });
  } catch (error) {
    logger.error('Convert PO to invoice error', { error: error instanceof Error ? error.message : String(error) });

    // Handle unique constraint violation on invoice number
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Un numero de facture fournisseur existe deja. Veuillez reessayer.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la conversion du bon de commande en facture' },
      { status: 500 }
    );
  }
});
