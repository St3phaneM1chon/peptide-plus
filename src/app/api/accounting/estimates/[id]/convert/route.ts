export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// POST /api/accounting/estimates/[id]/convert
// Convert an ACCEPTED estimate to a CustomerInvoice.
// Copies all items, links via invoiceId, transitions to CONVERTED.
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.estimate.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    // Only ACCEPTED estimates can be converted
    if (existing.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: `Impossible de convertir un devis avec le statut "${existing.status}". Seuls les devis acceptés peuvent être convertis en facture.` },
        { status: 400 }
      );
    }

    // Check not already converted
    if (existing.invoiceId) {
      return NextResponse.json(
        { error: 'Ce devis a déjà été converti en facture' },
        { status: 400 }
      );
    }

    // Create invoice and update estimate in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate invoice number
      const year = new Date().getFullYear();
      const prefix = `FACT-${year}-`;

      const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX("invoiceNumber") as max_num
        FROM "CustomerInvoice"
        WHERE "invoiceNumber" LIKE ${prefix + '%'}
        FOR UPDATE
      `;

      let nextNum = 1;
      if (maxRow?.max_num) {
        const num = parseInt(maxRow.max_num.split('-').pop() || '0');
        if (!isNaN(num)) nextNum = num + 1;
      }
      const invoiceNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;

      // Calculate dueDate: 30 days from now
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // Create the invoice from estimate data
      const invoice = await tx.customerInvoice.create({
        data: {
          invoiceNumber,
          customerId: existing.customerId,
          customerName: existing.customerName,
          customerEmail: existing.customerEmail,
          customerAddress: existing.customerAddress,
          subtotal: existing.subtotal,
          taxTps: existing.taxGst,
          taxTvq: existing.taxQst,
          taxTvh: 0,
          total: existing.total,
          balance: existing.total,
          discount: existing.discountAmount,
          invoiceDate: new Date(),
          dueDate,
          status: 'DRAFT',
          notes: existing.notes
            ? `Converti du devis ${existing.estimateNumber}. ${existing.notes}`
            : `Converti du devis ${existing.estimateNumber}`,
          items: {
            create: existing.items.map((item) => ({
              description: `${item.productName}${item.description ? ' - ' + item.description : ''}`,
              quantity: Math.round(Number(item.quantity)),
              unitPrice: item.unitPrice,
              discount: Number(item.discountPercent) > 0
                ? Number(item.unitPrice) * Number(item.quantity) * (Number(item.discountPercent) / 100)
                : 0,
              total: item.lineTotal,
              productId: item.productId,
            })),
          },
        },
        include: { items: true },
      });

      // Update estimate status to CONVERTED
      const updatedEstimate = await tx.estimate.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedAt: new Date(),
          invoiceId: invoice.id,
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });

      return { invoice, estimate: updatedEstimate };
    });

    // Audit trail
    logAuditTrail({
      entityType: 'Estimate',
      entityId: id,
      action: 'STATUS_CHANGE',
      field: 'status',
      oldValue: 'ACCEPTED',
      newValue: 'CONVERTED',
      userId: session.user.id || session.user.email || 'unknown',
      userName: session.user.name || undefined,
      metadata: {
        estimateNumber: existing.estimateNumber,
        invoiceId: result.invoice.id,
        invoiceNumber: result.invoice.invoiceNumber,
        convertedAt: new Date().toISOString(),
      },
    });

    logAuditTrail({
      entityType: 'CustomerInvoice',
      entityId: result.invoice.id,
      action: 'CREATE',
      userId: session.user.id || session.user.email || 'unknown',
      userName: session.user.name || undefined,
      metadata: {
        invoiceNumber: result.invoice.invoiceNumber,
        fromEstimate: existing.estimateNumber,
        fromEstimateId: id,
      },
    });

    logger.info('Estimate converted to invoice', {
      estimateId: id,
      estimateNumber: existing.estimateNumber,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
    });

    return NextResponse.json({
      success: true,
      invoice: {
        ...result.invoice,
        subtotal: Number(result.invoice.subtotal),
        shippingCost: Number(result.invoice.shippingCost),
        discount: Number(result.invoice.discount),
        taxTps: Number(result.invoice.taxTps),
        taxTvq: Number(result.invoice.taxTvq),
        taxTvh: Number(result.invoice.taxTvh),
        total: Number(result.invoice.total),
        amountPaid: Number(result.invoice.amountPaid),
        balance: Number(result.invoice.balance),
        items: result.invoice.items.map(item => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          total: Number(item.total),
        })),
      },
      estimate: {
        ...result.estimate,
        subtotal: Number(result.estimate.subtotal),
        discountAmount: Number(result.estimate.discountAmount),
        discountPercent: Number(result.estimate.discountPercent),
        taxGst: Number(result.estimate.taxGst),
        taxQst: Number(result.estimate.taxQst),
        taxTotal: Number(result.estimate.taxTotal),
        total: Number(result.estimate.total),
      },
      message: `Devis converti en facture ${result.invoice.invoiceNumber}`,
    });
  } catch (error) {
    logger.error('Convert estimate error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la conversion du devis en facture' },
      { status: 500 }
    );
  }
});
